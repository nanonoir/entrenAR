import { ERROR_CODE } from "../../common/errors/api-error.response";
import {
  ACCOUNT_ADDRESS_CREATION_STATUS,
  AccountRepository,
} from "./account.repository";
import { AccountService } from "./account.service";
import type { AccountAddressInput, AccountProfileUpdateInput } from "./account.schemas";
import type { AccountAddressRecord, AccountOrderRecord, AccountProfileRecord } from "./account.mapper";

const PROFILE_RECORD: AccountProfileRecord = {
  birthDate: new Date("1990-01-01T00:00:00.000Z"),
  dni: "12345678",
  email: "customer@entrenar.test",
  firstName: "Ada",
  gender: "other",
  lastName: "Lovelace",
  phone: "+54 11 5555-5555",
};

const ADDRESS_RECORD: AccountAddressRecord = {
  city: "Buenos Aires",
  id: "address-1",
  label: "Home",
  phone: "+54 11 5555-5555",
  postalCode: "C1000",
  province: "Buenos Aires",
  recipient: "Ada Lovelace",
  street: "123 Main Street",
};

const PROFILE_UPDATE: AccountProfileUpdateInput = {
  birthDate: "1991-02-03",
  dni: "87654321",
  firstName: "Grace",
  gender: "other",
  lastName: "Hopper",
  phone: "+54 11 5555-4444",
};

const ADDRESS_INPUT: AccountAddressInput = {
  city: "Cordoba",
  label: "Office",
  phone: "+54 351 555-5555",
  postalCode: "X5000",
  province: "Cordoba",
  recipient: "Grace Hopper",
  street: "456 Test Avenue",
};

describe("account.service", () => {
  it("maps a customer profile to a secret-free projection scoped by user id", async () => {
    const harness = createHarness();
    harness.repository.findProfileByUserId.mockResolvedValue({
      ...PROFILE_RECORD,
      passwordHash: "must-not-cross-the-boundary",
    });

    const profile = await harness.service.getProfile("customer-a");

    expect(harness.repository.findProfileByUserId).toHaveBeenCalledWith("customer-a");
    expect(profile).toEqual({
      birthDate: "1990-01-01",
      dni: "12345678",
      email: "customer@entrenar.test",
      firstName: "Ada",
      gender: "other",
      lastName: "Lovelace",
      phone: "+54 11 5555-5555",
    });
    expect(profile).not.toHaveProperty("passwordHash");
  });

  it("updates only the authenticated account projection", async () => {
    const harness = createHarness();
    harness.repository.updateProfile.mockResolvedValue(PROFILE_RECORD);

    await harness.service.updateProfile("customer-a", PROFILE_UPDATE);

    expect(harness.repository.updateProfile).toHaveBeenCalledWith("customer-a", PROFILE_UPDATE);
  });

  it("maps only owned address fields when listing addresses", async () => {
    const harness = createHarness();
    harness.repository.listAddresses.mockResolvedValue([{
      ...ADDRESS_RECORD,
      userId: "customer-a",
    }]);

    await expect(harness.service.listAddresses("customer-a")).resolves.toEqual([{
      city: "Buenos Aires",
      id: "address-1",
      label: "Home",
      phone: "+54 11 5555-5555",
      postalCode: "C1000",
      province: "Buenos Aires",
      recipient: "Ada Lovelace",
      street: "123 Main Street",
    }]);
    expect(harness.repository.listAddresses).toHaveBeenCalledWith("customer-a");
  });

  it("creates and maps an owned address", async () => {
    const harness = createHarness();
    harness.repository.createAddress.mockResolvedValue({
      address: ADDRESS_RECORD,
      status: ACCOUNT_ADDRESS_CREATION_STATUS.CREATED,
    });

    await expect(harness.service.createAddress("customer-a", ADDRESS_INPUT)).resolves.toEqual({
      city: "Buenos Aires",
      id: "address-1",
      label: "Home",
      phone: "+54 11 5555-5555",
      postalCode: "C1000",
      province: "Buenos Aires",
      recipient: "Ada Lovelace",
      street: "123 Main Street",
    });
    expect(harness.repository.createAddress).toHaveBeenCalledWith("customer-a", ADDRESS_INPUT);
  });

  it("turns the server six-address status into ADDRESS_LIMIT_REACHED without mapping a missing address", async () => {
    const harness = createHarness();
    harness.repository.createAddress.mockResolvedValue({
      status: ACCOUNT_ADDRESS_CREATION_STATUS.LIMIT_REACHED,
    });

    await expect(harness.service.createAddress("customer-a", ADDRESS_INPUT)).rejects.toMatchObject({
      response: {
        code: ERROR_CODE.ADDRESS_LIMIT_REACHED,
        ok: false,
      },
      status: 409,
    });
  });

  it("returns a safe not-found error when the account disappears during address creation", async () => {
    const harness = createHarness();
    harness.repository.createAddress.mockResolvedValue({
      status: ACCOUNT_ADDRESS_CREATION_STATUS.USER_NOT_FOUND,
    });

    await expect(harness.service.createAddress("customer-a", ADDRESS_INPUT)).rejects.toMatchObject({
      response: {
        code: ERROR_CODE.NOT_FOUND,
        ok: false,
      },
      status: 404,
    });
  });

  it("does not expose a foreign address when update or delete is scoped away", async () => {
    const harness = createHarness();
    harness.repository.updateAddress.mockResolvedValue(null);
    harness.repository.deleteAddress.mockResolvedValue(false);

    await expect(harness.service.updateAddress("customer-a", "foreign-address", ADDRESS_INPUT)).rejects.toMatchObject({
      response: { code: ERROR_CODE.NOT_FOUND, ok: false },
      status: 404,
    });
    await expect(harness.service.deleteAddress("customer-a", "foreign-address")).rejects.toMatchObject({
      response: { code: ERROR_CODE.NOT_FOUND, ok: false },
      status: 404,
    });

    expect(harness.repository.updateAddress).toHaveBeenCalledWith("customer-a", "foreign-address", ADDRESS_INPUT);
    expect(harness.repository.deleteAddress).toHaveBeenCalledWith("customer-a", "foreign-address");
  });

  it("keeps account orders empty until order persistence exists", async () => {
    const harness = createHarness();

    await expect(harness.service.listOrders("customer-a", { limit: 20, page: 1 })).resolves.toEqual([]);
  });

  it("maps JWT-scoped order snapshots without exposing mutable catalog relations", async () => {
    const harness = createHarness();
    harness.repository.listOrders.mockResolvedValue([{
      createdAt: new Date("2026-08-31T12:00:00.000Z"),
      id: "order-1",
      items: [{ id: "order-item-1", productName: "Persisted product", quantity: 2, unitPrice: "49.99" }],
      number: "EN-ORDER-1",
      status: "PENDING",
      total: "99.98",
    } as unknown as AccountOrderRecord]);

    await expect(harness.service.listOrders("customer-a", { limit: 20, page: 1 })).resolves.toEqual([{
      date: "2026-08-31T12:00:00.000Z",
      id: "order-1",
      items: [{ id: "order-item-1", name: "Persisted product", price: 49.99, quantity: 2 }],
      status: "preparacion",
      total: 99.98,
      trackingCode: "EN-ORDER-1",
    }]);
    expect(harness.repository.listOrders).toHaveBeenCalledWith("customer-a", 0, 20);
  });

  it("maps a successful address update and deletion result", async () => {
    const harness = createHarness();
    harness.repository.updateAddress.mockResolvedValue(ADDRESS_RECORD);
    harness.repository.deleteAddress.mockResolvedValue(true);

    await expect(harness.service.updateAddress("customer-a", "address-1", ADDRESS_INPUT)).resolves.toEqual({
      city: "Buenos Aires",
      id: "address-1",
      label: "Home",
      phone: "+54 11 5555-5555",
      postalCode: "C1000",
      province: "Buenos Aires",
      recipient: "Ada Lovelace",
      street: "123 Main Street",
    });
    await expect(harness.service.deleteAddress("customer-a", "address-1")).resolves.toEqual({ ok: true });
  });
});

function createHarness(): AccountHarness {
  const repository = {
    createAddress: jest.fn(),
    deleteAddress: jest.fn(),
    findProfileByUserId: jest.fn(),
    listAddresses: jest.fn(),
    updateAddress: jest.fn(),
    updateProfile: jest.fn(),
    listOrders: jest.fn().mockResolvedValue([]),
  };

  return {
    repository,
    service: new AccountService(repository as unknown as AccountRepository),
  };
}

interface AccountHarness {
  repository: {
    createAddress: jest.Mock;
    deleteAddress: jest.Mock;
    findProfileByUserId: jest.Mock;
    listAddresses: jest.Mock;
    listOrders: jest.Mock;
    updateAddress: jest.Mock;
    updateProfile: jest.Mock;
  };
  service: AccountService;
}
