import type { PrismaService } from "../../common/prisma/prisma.service";
import { Prisma } from "../../generated/prisma/client";
import { MUTATION_GATE_LOCK_KEY } from "../../common/prisma/mutation-gate";
import { CrmShowcaseService } from "./crm-showcase.service";
import { assembleScenario, SHOWCASE_COUNTS } from "./scenario";
import type { AuthorizedTarget } from "./target-policy";

describe("CRM showcase transaction boundary", () => {
  const input = { seed: "demo", referenceDate: new Date("2026-10-09T15:00:00Z") };
  const target = { identity: { fingerprint: "destination", database: "entrenar_crm_demo_test" }, authorization: { serverAddress: "172.20.0.2" } } as AuthorizedTarget;
  function harness(metadata: unknown) {
    const tx = { $executeRawUnsafe: jest.fn(), $executeRaw: jest.fn(), $queryRaw: jest.fn().mockResolvedValue([{ database: target.identity.database, schema: "public", address: target.authorization.serverAddress }]), orderHistory: { findUnique: jest.fn().mockResolvedValue({ orderId: assembleScenario({ ...input, seed: "original-seed" }).id("order", 0), type: "NOTE_ADDED", title: "CRM showcase simulation complete", metadata, createdAt: input.referenceDate }), create: jest.fn() } };
    const prisma = { $transaction: jest.fn(async (callback: (value: unknown) => unknown) => callback(tx)) } as unknown as PrismaService;
    return { tx, prisma, service: new CrmShowcaseService(prisma, target) };
  }
  it("acquires existing exclusive gate before identity/marker reads with bounded READ COMMITTED transaction", async () => {
    const fixture = harness({ complete: true, version: "1", seed: "original-seed", referenceInstant: input.referenceDate.toISOString(), baselineDigest: "a".repeat(64), manifestDigest: "b".repeat(64), counts: SHOWCASE_COUNTS, initialBalances: { imported: 7 } });
    await expect(fixture.service.run({ ...input, seed: "a-new-seed" })).resolves.toEqual({ status: "already-generated", destinationFingerprint: "destination" });
    expect(fixture.prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), { timeout: 120_000, maxWait: 15_000, isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
    expect(fixture.tx.$executeRawUnsafe).toHaveBeenNthCalledWith(1, "SET LOCAL lock_timeout = '10s'");
    expect(fixture.tx.$executeRaw.mock.calls[0][1]).toBe(MUTATION_GATE_LOCK_KEY);
    expect(fixture.tx.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(fixture.tx.orderHistory.findUnique.mock.invocationCallOrder[0]!);
    expect(fixture.tx.orderHistory.create).not.toHaveBeenCalled();
    expect(fixture.prisma.$transaction).toHaveBeenCalledTimes(1);
  });
  it("rejects malformed marker without any history inserts", async () => {
    const fixture = harness({ complete: false });
    await expect(fixture.service.run(input)).rejects.toThrow("Malformed");
    expect(fixture.tx.orderHistory.create).not.toHaveBeenCalled();
  });
  it("checks actual connected identity before accepting even a valid marker", async () => {
    const fixture = harness({});
    fixture.tx.$queryRaw.mockResolvedValue([{ database: "entrenar", schema: "public", address: target.authorization.serverAddress }]);
    await expect(fixture.service.run(input)).rejects.toThrow("Connected showcase");
    expect(fixture.tx.orderHistory.findUnique).not.toHaveBeenCalled();
  });
});
