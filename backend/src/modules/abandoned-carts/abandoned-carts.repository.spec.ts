import { PrismaService } from "../../common/prisma/prisma.service";
import type { Prisma } from "../../generated/prisma/client";
import { CheckoutRecoveryStatus } from "../../generated/prisma/enums";
import { AbandonedCartsRepository, abandonedCartWhere } from "./abandoned-carts.repository";

describe("AbandonedCartsRepository", () => {
  it("builds abandoned, status, date, total, and search filters", () => {
    const where = abandonedCartWhere({
      from: new Date("2026-09-01T00:00:00.000Z"),
      maxTotal: 500,
      minTotal: 100,
      search: "camila",
      status: CheckoutRecoveryStatus.PENDING,
      to: new Date("2026-09-05T00:00:00.000Z"),
    });

    expect(where).toEqual(expect.objectContaining({
      OR: expect.any(Array),
      abandonedAt: { gte: new Date("2026-09-01T00:00:00.000Z"), lte: new Date("2026-09-05T00:00:00.000Z") },
      recoveryStatus: CheckoutRecoveryStatus.PENDING,
      snapshotData: { path: ["total"], gte: 100, lte: 500 },
      AND: expect.any(Array),
    }));
  });

  it("lists records with pagination, sorting, total count, and recovery metrics", async () => {
    const harness = createHarness();
    harness.prisma.checkoutSession.findMany
      .mockResolvedValueOnce([{ id: "session-1", snapshotData: { total: 125 } }])
      .mockResolvedValueOnce([{ snapshotData: { total: 125 } }, { snapshotData: { total: 75 } }]);
    harness.prisma.checkoutSession.count
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0);

    const result = await harness.repository.findMany(
      { status: CheckoutRecoveryStatus.PENDING, search: "camila" },
      { limit: 10, page: 2 },
      { sortBy: "abandonedAt", sortOrder: "asc" },
    );

    expect(result).toEqual({ items: [{ id: "session-1", snapshotData: { total: 125 } }], metrics: { pendingCount: 1, recoverableTotal: 200, recoveredCount: 0 }, total: 2 });
    expect(harness.prisma.checkoutSession.findMany).toHaveBeenNthCalledWith(1, expect.objectContaining({ skip: 10, take: 10, orderBy: [{ abandonedAt: "asc" }, { id: "asc" }] }));
    expect(harness.prisma.checkoutSession.count).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ recoveryStatus: CheckoutRecoveryStatus.PENDING }) }));
  });

  it("propagates transaction clients and keeps history append-only", async () => {
    const harness = createHarness();
    const transaction = harness.transaction;
    transaction.checkoutSession.update.mockResolvedValue({ id: "session-1" });
    transaction.checkoutSessionHistory.create.mockResolvedValue({ id: "history-1" });

    await harness.repository.updateRecoveryStatus("session-1", CheckoutRecoveryStatus.MANUAL, transaction);
    await harness.repository.updateRecoveryEmailSent("session-1", "hash", new Date("2026-09-12"), new Date("2026-09-05"), transaction);
    await harness.repository.appendHistoryEvent("session-1", "MANUAL_CONTACT_LOGGED", "admin-1", "ADMIN", "Called customer", { channel: "phone" }, transaction);

    expect(transaction.checkoutSession.update).toHaveBeenNthCalledWith(1, expect.objectContaining({ data: { recoveryStatus: CheckoutRecoveryStatus.MANUAL }, where: { id: "session-1" } }));
    expect(transaction.checkoutSession.update).toHaveBeenNthCalledWith(2, expect.objectContaining({ data: expect.objectContaining({ recoveryStatus: CheckoutRecoveryStatus.SENT, recoveryTokenHash: "hash" }) }));
    expect(transaction.checkoutSessionHistory.create).toHaveBeenCalledWith({ data: expect.objectContaining({ checkoutSessionId: "session-1", eventType: "MANUAL_CONTACT_LOGGED", metadata: { channel: "phone" } }) });
    expect(transaction.checkoutSessionHistory.update).not.toHaveBeenCalled();
  });

  it("creates default settings only when the singleton is missing", async () => {
    const harness = createHarness();
    harness.prisma.cartRecoverySettings.findUnique.mockResolvedValue(null);
    harness.prisma.cartRecoverySettings.create.mockResolvedValue({ id: "singleton", timing: "24hs" });

    await harness.repository.getSettings();

    expect(harness.prisma.cartRecoverySettings.findUnique).toHaveBeenCalledWith({ where: { id: "singleton" } });
    expect(harness.prisma.cartRecoverySettings.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ id: "singleton", timing: "24hs" }) }));
  });
});

function createHarness() {
  interface MockTransaction {
    checkoutSession: { update: jest.Mock };
    checkoutSessionHistory: { create: jest.Mock; update: jest.Mock };
  }
  interface MockPrisma extends MockTransaction {
    $transaction: jest.Mock;
    cartRecoverySettings: { create: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
    checkoutSession: { count: jest.Mock; findMany: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
  }

  const transaction = {
    checkoutSession: { update: jest.fn() },
    checkoutSessionHistory: { create: jest.fn(), update: jest.fn() },
  } as unknown as MockTransaction & Prisma.TransactionClient;
  const prisma = {
    $transaction: jest.fn((callback: (client: MockTransaction & Prisma.TransactionClient) => Promise<unknown>) => callback(transaction)),
    cartRecoverySettings: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    checkoutSession: { count: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
  } as unknown as MockPrisma & PrismaService;

  return { prisma, repository: new AbandonedCartsRepository(prisma), transaction };
}
