import {
  ACCOUNT_MAX_ADDRESSES,
  accountAddressInputSchema,
  accountAddressSchema,
  accountOrderListQuerySchema,
  accountProfileSchema,
  accountProfileUpdateSchema,
  addressIdSchema,
} from "./account.schemas";

const validProfile = {
  birthDate: "1990-01-01",
  dni: "12345678",
  email: "customer@entrenar.test",
  firstName: "Ada",
  gender: "other",
  lastName: "Lovelace",
  phone: "+54 11 5555-5555",
};

const validAddress = {
  city: "Buenos Aires",
  label: "Home",
  phone: "+54 11 5555-5555",
  postalCode: "C1000",
  province: "Buenos Aires",
  recipient: "Ada Lovelace",
  street: "123 Main Street",
};

describe("customer account schemas", () => {
  it("normalizes a valid public profile while retaining only the declared projection", () => {
    expect(accountProfileSchema.parse({
      ...validProfile,
      email: "CUSTOMER@ENTRENAR.TEST",
      firstName: " Ada ",
    })).toEqual({
      ...validProfile,
      email: "customer@entrenar.test",
      firstName: "Ada",
    });
  });

  it.each([
    { ...validProfile, dni: "12345" },
    { ...validProfile, dni: "1234567890" },
    { ...validProfile, dni: "1234ABCD" },
    { ...validProfile, passwordHash: "must-not-cross-the-boundary" },
  ])("rejects invalid or secret-bearing profile input: %o", (input) => {
    expect(accountProfileSchema.safeParse(input).success).toBe(false);
  });

  it("keeps email out of the profile update contract", () => {
    const profileUpdate = {
      birthDate: validProfile.birthDate,
      dni: validProfile.dni,
      firstName: validProfile.firstName,
      gender: validProfile.gender,
      lastName: validProfile.lastName,
      phone: validProfile.phone,
    };

    expect(accountProfileUpdateSchema.parse(profileUpdate)).toEqual(profileUpdate);
    expect(accountProfileUpdateSchema.safeParse({ ...profileUpdate, email: validProfile.email }).success).toBe(false);
  });

  it("validates address creation separately from the server-owned address id", () => {
    expect(accountAddressInputSchema.parse(validAddress)).toEqual(validAddress);
    expect(accountAddressInputSchema.safeParse({ ...validAddress, id: "foreign-address" }).success).toBe(false);
    expect(accountAddressInputSchema.safeParse({ ...validAddress, userId: "foreign-user" }).success).toBe(false);
    expect(accountAddressSchema.parse({ ...validAddress, id: "address-1" })).toEqual({
      ...validAddress,
      id: "address-1",
    });
  });

  it.each([
    { ...validAddress, phone: "12" },
    { ...validAddress, postalCode: "" },
    { ...validAddress, street: "   " },
    { ...validAddress, resetToken: "must-not-cross-the-boundary" },
  ])("rejects invalid or secret-bearing address input: %o", (input) => {
    expect(accountAddressInputSchema.safeParse(input).success).toBe(false);
  });

  it("normalizes address ids and applies safe order-query defaults and limits", () => {
    expect(addressIdSchema.parse(" address-1 ")).toBe("address-1");
    expect(accountOrderListQuerySchema.parse({})).toEqual({ limit: 20, page: 1 });
    expect(accountOrderListQuerySchema.parse({ limit: "100", page: "2" })).toEqual({ limit: 100, page: 2 });
    expect(accountOrderListQuerySchema.safeParse({ limit: 101 }).success).toBe(false);
    expect(accountOrderListQuerySchema.safeParse({ page: 0 }).success).toBe(false);
    expect(accountOrderListQuerySchema.safeParse({ accountId: "foreign-account" }).success).toBe(false);
  });

  it("keeps the six-address invariant explicit at the domain boundary", () => {
    expect(ACCOUNT_MAX_ADDRESSES).toBe(6);
  });
});
