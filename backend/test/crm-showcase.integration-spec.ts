import "reflect-metadata";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { PrismaService } from "../src/common/prisma/prisma.service";
import { MUTATION_GATE_LOCK_KEY } from "../src/common/prisma/mutation-gate";
import { CrmShowcaseService, readBaseline, assertBaselinePrerequisites, assertCompletionMarker, FAULT_POINT } from "../src/modules/crm-showcase/crm-showcase.service";
import { parseShowcaseArguments, type ShowcaseCommandInput } from "../src/modules/crm-showcase/crm-showcase.command";
import { authorizeTarget, type AuthorizedTarget } from "../src/modules/crm-showcase/target-policy";
import { digest, SHOWCASE_NAMESPACE, SHOWCASE_COUNTS } from "../src/modules/crm-showcase/scenario";
import { InventoryRepository } from "../src/modules/inventory/inventory.repository";
import { SalesRepository } from "../src/modules/sales/sales.repository";
import { SalesService } from "../src/modules/sales/sales.service";
import { PurchaseOrdersRepository } from "../src/modules/purchase-orders/purchase-orders.repository";
import { PurchaseOrdersService } from "../src/modules/purchase-orders/purchase-orders.service";
import { OrderStatus, PaymentStatus, PurchaseOrderStatus } from "../src/generated/prisma/enums";
import { StatisticsRepository } from "../src/modules/statistics/statistics.repository";
import { StatisticsService, resolveStatisticsWindows } from "../src/modules/statistics/statistics.service";
import { STATISTICS_PERIOD } from "../src/modules/statistics/statistics.schemas";
import { abandonedCartInclude, toAbandonedCartDetailDto } from "../src/modules/abandoned-carts/abandoned-carts.mapper";
import { customerIdentifierSchema } from "../src/modules/customers/customers.schemas";

// No cleanup/reset is performed. This fixture consumes one explicitly authorized disposable restored copy.
describe("CRM showcase isolated persistence", () => {
  let prisma: PrismaService | undefined;
  let input: ShowcaseCommandInput;
  let target: AuthorizedTarget;
  let service: CrmShowcaseService;
  let copyB: PrismaService | undefined;
  let targetB: AuthorizedTarget;
  let authenticationDigest: string;
  const prior = process.env.DATABASE_URL;
  const priorE2e = process.env.DATABASE_URL_E2E;
  async function wholeState() { return digest(await prisma!.$transaction((tx) => readBaseline(tx))); }

  beforeAll(async () => {
    const url = process.env.CRM_SHOWCASE_DATABASE_URL;
    const path = process.env.CRM_SHOWCASE_AUTHORIZATION;
    const seed = process.env.CRM_SHOWCASE_SEED;
    const reference = process.env.CRM_SHOWCASE_REFERENCE_DATE;
    const urlB = process.env.CRM_SHOWCASE_DATABASE_URL_B;
    const pathB = process.env.CRM_SHOWCASE_AUTHORIZATION_B;
    if (!url || !path || !seed || !reference || !urlB || !pathB) throw new Error("BLOCKED: explicit CRM_SHOWCASE_DATABASE_URL/AUTHORIZATION, CRM_SHOWCASE_DATABASE_URL_B/AUTHORIZATION_B, CRM_SHOWCASE_SEED and CRM_SHOWCASE_REFERENCE_DATE are required; habitual URLs are forbidden.");
    target = authorizeTarget(url, JSON.parse(await readFile(path, "utf8")), process.env.NODE_ENV);
    if (process.env.CRM_SHOWCASE_DISPOSABLE !== target.identity.fingerprint) throw new Error("BLOCKED: CRM_SHOWCASE_DISPOSABLE must attest this fixture destination fingerprint.");
    targetB = authorizeTarget(urlB, JSON.parse(await readFile(pathB, "utf8")), process.env.NODE_ENV);
    if (target.identity.database === "entrenar" || targetB.identity.database === "entrenar") throw new Error("Local owner destination is never a disposable test fixture.");
    if (process.env.CRM_SHOWCASE_DISPOSABLE_B !== targetB.identity.fingerprint || targetB.identity.fingerprint === target.identity.fingerprint || targetB.identity.database === target.identity.database || target.authorization.baselineDumpSha256 !== targetB.authorization.baselineDumpSha256 || target.authorization.baselineDigest !== targetB.authorization.baselineDigest) throw new Error("BLOCKED: reproducibility requires a separately authorized disposable copy of the same dump/baseline.");
    input = parseShowcaseArguments(["--seed", seed, "--reference-date", reference, "--authorization", path]);
    process.env.DATABASE_URL = urlB;
    copyB = new PrismaService();
    const baselineB = await copyB.$transaction((tx) => readBaseline(tx));
    assertBaselinePrerequisites(baselineB, targetB.authorization.trustedOwner === true);
    if (digest(baselineB) !== targetB.authorization.baselineDigest) throw new Error("BLOCKED: copy B baseline mismatch.");
    process.env.DATABASE_URL = url;
    process.env.DATABASE_URL_E2E = url;
    prisma = new PrismaService();
    const baseline = await prisma.$transaction((tx) => readBaseline(tx));
    assertBaselinePrerequisites(baseline, target.authorization.trustedOwner === true);
    authenticationDigest = digest([baseline.User, baseline.RefreshToken, baseline.PasswordResetToken]);
    if (digest(baseline) !== target.authorization.baselineDigest) throw new Error("BLOCKED: fixture must start from the authorized clean restored baseline.");
    service = new CrmShowcaseService(prisma, target);
  });
  afterAll(async () => {
    await prisma?.$disconnect();
    await copyB?.$disconnect();
    if (prior === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = prior;
    if (priorE2e === undefined) delete process.env.DATABASE_URL_E2E; else process.env.DATABASE_URL_E2E = priorE2e;
  });

  it("rejects partial namespace and case-insensitive coupon collisions without repairing rows", async () => {
    const before = await wholeState();
    await expect(prisma!.$transaction(async (tx) => {
      await tx.customer.create({ data: { id: "crm-showcase:partial", fullName: "Demo Ficticio", email: "partial@example.invalid" } });
      assertBaselinePrerequisites(await readBaseline(tx));
    })).rejects.toThrow("namespace");
    expect(await wholeState()).toBe(before);
    await expect(prisma!.$transaction(async (tx) => {
      await tx.coupon.create({ data: { id: "collision-fixture", code: "crm-demo-coupon-1", discountType: "FIXED", discountValue: 1, targetType: "ALL_STORE" } });
      assertBaselinePrerequisites(await readBaseline(tx));
    })).rejects.toThrow("namespace");
    expect(await wholeState()).toBe(before);
  });

  it.each(Object.values(FAULT_POINT))("rolls back whole state at %s, including stock/flags/timestamps", async (point) => {
    const before = await wholeState();
    await expect(service.run(input, (current) => { if (current === point) throw new Error("test-only fault"); })).rejects.toThrow("test-only fault");
    expect(await wholeState()).toBe(before);
  });

  it("bounds competing gate wait and leaves no writes after lock timeout", async () => {
    const before = await wholeState();
    const holder = new PrismaService();
    let release!: () => void, acquired!: () => void;
    const ready = new Promise<void>((resolveReady) => { acquired = resolveReady; });
    const hold = new Promise<void>((resolveHold) => { release = resolveHold; });
    const holding = holder.$transaction(async (tx) => { await tx.$executeRaw`SELECT pg_advisory_xact_lock(${MUTATION_GATE_LOCK_KEY})`; acquired(); await hold; }, { timeout: 30000 });
    try {
      await Promise.race([ready, holding]);
      await expect(service.run(input)).rejects.toThrow();
    } finally { release(); await holding; await holder.$disconnect(); }
    expect(await wholeState()).toBe(before);
  });

  it("two independent CLI processes produce one atomic scenario", async () => {
    const results = await Promise.all([runCli(input), runCli(input)]);
    expect(results.filter((result) => result.code === 0 && result.output.includes('"status":"generated"')).length).toBe(1);
    for (const result of results) expect(result.code === 0 && /already-generated|generated/.test(result.output) || result.code === 1).toBe(true);
    expect((await service.run(input)).status).toBe("already-generated");
    expect(await prisma!.order.count({ where: { id: { startsWith: SHOWCASE_NAMESPACE } } })).toBe(SHOWCASE_COUNTS.orders);
  });

  it("preserves immutable snapshots and append-only ledger triggers", async () => {
    const before = await wholeState();
    const item = await prisma!.orderItem.findFirstOrThrow({ where: { id: { startsWith: SHOWCASE_NAMESPACE } } });
    const movement = await prisma!.inventoryHistory.findFirstOrThrow({ where: { id: { startsWith: SHOWCASE_NAMESPACE } } });
    await expect(prisma!.orderItem.update({ where: { id: item.id }, data: { productName: "illegal snapshot update" } })).rejects.toThrow();
    await expect(prisma!.inventoryHistory.update({ where: { id: movement.id }, data: { reason: "illegal ledger update" } })).rejects.toThrow();
    expect(await wholeState()).toBe(before);
    await expect(prisma!.$transaction(async (tx) => {
      const marker = await tx.orderHistory.update({ where: { id: "crm-showcase:completion" }, data: { metadata: { complete: false } } });
      assertCompletionMarker(marker);
    })).rejects.toThrow("Malformed");
    expect(await wholeState()).toBe(before);
  });

  it("reproduces immutable generated graph, balances and flags across restored copies", async () => {
    const marker = await prisma!.orderHistory.findUniqueOrThrow({ where: { id: "crm-showcase:completion" } });
    const evidence = marker.metadata as Record<string, unknown>;
    const result = await new CrmShowcaseService(copyB!, targetB).run(input);
    expect(result.status).toBe("generated");
    expect(result.manifestDigest).toBe(evidence.manifestDigest);
  });

  it("feeds real sales/details/statistics/coupon/abandonment read consumers", async () => {
    const repository = new StatisticsRepository(prisma!);
    for (const period of [STATISTICS_PERIOD.TODAY, STATISTICS_PERIOD.CURRENT_WEEK, STATISTICS_PERIOD.LAST_30_DAYS]) {
      const window = resolveStatisticsWindows({ period }, input.referenceDate).current;
      const kpis = await repository.getOverviewKpis(window.from, window.to);
      expect(kpis.grossRevenue).toBeGreaterThan(0);
      expect(kpis.paidOrders).toBeGreaterThan(0);
      expect(kpis.checkoutSessions).toBeGreaterThan(0);
    }
    const from = new Date(input.referenceDate.getTime() - 60 * 86400000).toISOString().slice(0, 10);
    const query = { period: STATISTICS_PERIOD.CUSTOM, from, to: input.referenceDate.toISOString().slice(0, 10), limit: 30 };
    const stats = new StatisticsService(repository);
    const overview = await stats.getOverview(query);
    expect(overview.data.metrics.averageTicket!.current).toBeGreaterThan(0);
    expect((await stats.getProducts(query)).data.topProducts.length).toBeGreaterThan(0);
    expect((await stats.getCustomers(query)).data.topCustomers.length).toBe(SHOWCASE_COUNTS.customers);
    const customers = await prisma!.customer.findMany({ where: { id: { startsWith: SHOWCASE_NAMESPACE } } });
    for (const customer of customers) expect(customerIdentifierSchema.parse(customer.id)).toBe(customer.id);
    expect((await stats.getCoupons(query)).data.topCoupons.length).toBeGreaterThan(0);
    const sales = new SalesService(new SalesRepository(prisma!), new InventoryRepository(prisma!));
    const order = await prisma!.order.findFirstOrThrow({ where: { id: { startsWith: SHOWCASE_NAMESPACE } } });
    expect((await sales.get(order.id)).id).toBe(order.id);
    const abandoned = await prisma!.checkoutSession.findMany({ include: abandonedCartInclude, where: { id: { startsWith: SHOWCASE_NAMESPACE }, status: "ABANDONED" } });
    expect(abandoned.length).toBe(SHOWCASE_COUNTS.abandonments);
    for (const session of abandoned) expect(toAbandonedCartDetailDto(session).total).toBeGreaterThan(0);
  });

  it("supports real confirmation, cancellation and receipt, then no-ops after admin writes", async () => {
    const inventory = new InventoryRepository(prisma!);
    const sales = new SalesService(new SalesRepository(prisma!), inventory);
    const purchases = new PurchaseOrdersService(new PurchaseOrdersRepository(prisma!), inventory);
    const pending = await prisma!.order.findFirstOrThrow({ where: { id: { startsWith: SHOWCASE_NAMESPACE }, status: OrderStatus.PENDING, payment: { status: PaymentStatus.PENDING } } });
    const quantityBefore = digest(await prisma!.productVariant.findMany({ orderBy: { id: "asc" } }));
    await sales.confirm(pending.id);
    expect(digest(await prisma!.productVariant.findMany({ orderBy: { id: "asc" } }))).toBe(quantityBefore);
    await sales.cancel(pending.id, { restoreStock: true, cancellationReason: "CRM-DEMO integration operation" });
    const afterCancellation = await wholeState();
    await expect(sales.cancel(pending.id, { restoreStock: true, cancellationReason: "duplicate" })).rejects.toThrow();
    expect(await wholeState()).toBe(afterCancellation);
    const ordered = await prisma!.purchaseOrder.findFirstOrThrow({ where: { id: { startsWith: SHOWCASE_NAMESPACE }, status: PurchaseOrderStatus.ORDERED } });
    await purchases.receive(ordered.id);
    const afterReceipt = await wholeState();
    await expect(purchases.receive(ordered.id)).rejects.toThrow();
    expect(await wholeState()).toBe(afterReceipt);
    const final = await prisma!.$transaction((tx) => readBaseline(tx));
    expect(digest([final.User, final.RefreshToken, final.PasswordResetToken])).toBe(authenticationDigest);
    expect((await service.run({ ...input, seed: "changed-after-admin" })).status).toBe("already-generated");
    expect(await wholeState()).toBe(afterReceipt);
  });
});

async function runCli(input: ShowcaseCommandInput): Promise<{ code: number | null; output: string }> {
  const args = [resolve("dist/src/modules/crm-showcase/crm-showcase.main.js"), "--seed", input.seed, "--reference-date", input.referenceDate.toISOString(), "--authorization", input.authorizationPath];
  const environment: NodeJS.ProcessEnv = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, NODE_ENV: "test", CRM_SHOWCASE_DATABASE_URL: process.env.CRM_SHOWCASE_DATABASE_URL };
  return new Promise((resolveResult, reject) => {
    const child = spawn(process.execPath, args, { windowsHide: true, env: environment, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", (chunk: Buffer) => { output += chunk.toString(); });
    child.stderr.on("data", () => { /* Generic command errors are intentionally not interpreted as private database exceptions. */ });
    const deadline = setTimeout(() => { child.kill(); reject(new Error("Isolated CLI test deadline exceeded.")); }, 140000);
    child.on("error", () => { clearTimeout(deadline); reject(new Error("Isolated CLI test failed to start.")); });
    child.on("close", (code) => { clearTimeout(deadline); resolveResult({ code, output }); });
  });
}
