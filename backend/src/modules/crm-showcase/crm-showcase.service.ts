import { MutationGate } from "../../common/prisma/mutation-gate";
import type { PrismaService } from "../../common/prisma/prisma.service";
import { Prisma } from "../../generated/prisma/client";
import { OrderHistoryEventType } from "../../generated/prisma/enums";
import { HistoricalWriter } from "./historical-writer";
import { assembleScenario, COMPLETION_ID, digest, SHOWCASE_COUNTS, SHOWCASE_NAMESPACE, SHOWCASE_VERSION, type ScenarioInput } from "./scenario";
import type { AuthorizedTarget } from "./target-policy";

export const BASELINE_TABLES = ["Category", "Product", "ProductVariant", "ProductImage", "ProductCategory", "CatalogSettings", "InventoryHistory", "PaymentMethodConfig", "ShippingProvider", "WeightBand", "PickupPoint", "PickupPointSchedule", "ShippingDiscount", "ShippingDiscountCategory", "User", "UserAddress", "RefreshToken", "PasswordResetToken", "WishlistItem", "Customer", "CustomerAddress", "Supplier", "PurchaseOrder", "PurchaseOrderItem", "Coupon", "CouponCategory", "CouponProduct", "CouponHistory", "CouponRedemption", "Cart", "CartItem", "CheckoutSession", "CheckoutSessionHistory", "CheckoutIdempotencyKey", "Order", "OrderItem", "OrderPayment", "OrderHistory", "CartRecoverySettings"] as const;
export type Baseline = Record<string, Record<string, unknown>[]>;
export interface ShowcaseResult { status: string; destinationFingerprint: string; counts?: typeof SHOWCASE_COUNTS; manifestDigest?: string; }
export const FAULT_POINT = { AFTER_LEDGER: "after-ledger", AFTER_FLAGS: "after-flags" } as const;
export type FaultPoint = (typeof FAULT_POINT)[keyof typeof FAULT_POINT];

export class CrmShowcaseService {
  constructor(private readonly prisma: PrismaService, private readonly target: AuthorizedTarget) {}

  async run(input: ScenarioInput, testFault?: (point: FaultPoint) => void): Promise<ShowcaseResult> {
    const scenario = assembleScenario(input);
    return new MutationGate().runExclusive(this.prisma, async (tx) => {
      await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '120s'");
      await this.assertConnectedIdentity(tx);
      const marker = await tx.orderHistory.findUnique({ where: { id: COMPLETION_ID } });
      if (marker) {
        assertCompletionMarker(marker);
        return { status: "already-generated", destinationFingerprint: this.target.identity.fingerprint };
      }
      const baseline = await readBaseline(tx);
      assertBaselinePrerequisites(baseline, this.target.authorization.trustedOwner === true);
      if (digest(baseline) !== this.target.authorization.baselineDigest) throw new Error("Showcase baseline digest does not match authorization.");
      await assertPersistencePrerequisites(tx);
      const writer = new HistoricalWriter(this.prisma);
      const evidence = await writer.write(tx, scenario, baseline, testFault);
      await tx.orderHistory.create({ data: {
        id: COMPLETION_ID, orderId: scenario.id("order", 0), type: OrderHistoryEventType.NOTE_ADDED,
        title: "CRM showcase simulation complete", createdAt: input.referenceDate,
        metadata: json({ complete: true, version: SHOWCASE_VERSION, seed: input.seed, referenceInstant: input.referenceDate.toISOString(), baselineDigest: digest(baseline), manifestDigest: evidence.manifestDigest, counts: SHOWCASE_COUNTS, initialBalances: evidence.initialBalances }),
      } });
      return { status: "generated", destinationFingerprint: this.target.identity.fingerprint, counts: SHOWCASE_COUNTS, manifestDigest: evidence.manifestDigest };
    }, { timeout: 120_000, maxWait: 15_000, isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  }

  private async assertConnectedIdentity(tx: Prisma.TransactionClient): Promise<void> {
    const [identity] = await tx.$queryRaw<{ database: string; schema: string; address: string | null }[]>`SELECT current_database() AS database, current_schema() AS schema, inet_server_addr()::text AS address`;
    if (!identity || identity.database !== this.target.identity.database || identity.schema !== "public" || identity.address !== this.target.authorization.serverAddress) {
      throw new Error("Connected showcase destination does not match authorization.");
    }
  }
}

export function assertCompletionMarker(marker: { orderId: string; type: string; title: string; metadata: unknown; createdAt: Date }): void {
  const metadata = marker.metadata;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) throw new Error("Malformed showcase completion marker.");
  const value = metadata as Record<string, unknown>;
  if (marker.type !== OrderHistoryEventType.NOTE_ADDED || marker.title !== "CRM showcase simulation complete" || !marker.orderId.startsWith(SHOWCASE_NAMESPACE) ||
      value.complete !== true || value.version !== SHOWCASE_VERSION || typeof value.seed !== "string" || !value.seed.trim() ||
      typeof value.referenceInstant !== "string" || value.referenceInstant !== marker.createdAt.toISOString() ||
      !/^[a-f0-9]{64}$/.test(String(value.baselineDigest)) || !/^[a-f0-9]{64}$/.test(String(value.manifestDigest)) ||
      digest(value.counts) !== digest(SHOWCASE_COUNTS) || !value.initialBalances || typeof value.initialBalances !== "object" || Array.isArray(value.initialBalances) ||
      !Object.keys(value.initialBalances).length || Object.entries(value.initialBalances).some(([key, balance]) => !key || balance !== null && (typeof balance !== "number" || !Number.isSafeInteger(balance) || balance < 0))) {
    throw new Error("Malformed showcase completion marker.");
  }
  if (assembleScenario({ seed: value.seed as string, referenceDate: marker.createdAt }).id("order", 0) !== marker.orderId) throw new Error("Malformed showcase completion marker.");
}

export async function readBaseline(tx: Prisma.TransactionClient): Promise<Baseline> {
  const baseline: Baseline = {};
  for (const table of BASELINE_TABLES) {
    // Identifiers are a static whitelist, never operator input. JSON normalizes decimals and dates across clients.
    const rows = await tx.$queryRawUnsafe<{ row: Record<string, unknown> }[]>(`SELECT row_to_json(t) AS row FROM public."${table}" t`);
    baseline[table] = rows.map(({ row }) => row).sort((a, b) => JSON.stringify(a) < JSON.stringify(b) ? -1 : JSON.stringify(a) > JSON.stringify(b) ? 1 : 0);
  }
  return baseline;
}

export function assertBaselinePrerequisites(baseline: Baseline, preserveAdministrators = false): void {
  for (const rows of Object.values(baseline)) {
    if (rows.some((row) => Object.values(row).some((value) => typeof value === "string" && (value.startsWith(SHOWCASE_NAMESPACE) || /^CRM-DEMO-/i.test(value))))) {
      throw new Error("Showcase namespace collision or incomplete scenario.");
    }
  }
  const emptyTables = ["Customer", "CustomerAddress", "Order", "OrderItem", "OrderPayment", "OrderHistory", "Supplier", "PurchaseOrder", "PurchaseOrderItem", "Cart", "CartItem", "CheckoutSession", "CheckoutSessionHistory", "CheckoutIdempotencyKey", "Coupon", "CouponHistory", "CouponRedemption", "RefreshToken", "PasswordResetToken", "UserAddress", "WishlistItem"];
  const requiredEmpty = preserveAdministrators ? emptyTables.filter((table) => !["RefreshToken", "PasswordResetToken"].includes(table)) : emptyTables;
  if (requiredEmpty.some((table) => baseline[table]?.length)) throw new Error("Showcase requires an uncontaminated commercial baseline without sessions or personal data.");
  if (baseline.User?.some((user) => user.role !== "ADMIN" || !preserveAdministrators && (typeof user.email !== "string" || !/@example\.(invalid|com|test)$/.test(user.email) || ["firstName", "lastName", "dni", "phone", "birthDate"].some((key) => user[key] != null)))) {
    throw new Error("Showcase baseline contains unverified personal data.");
  }
  if (preserveAdministrators) {
    const administrators = new Set(baseline.User?.map((user) => user.id));
    if ([...(baseline.RefreshToken ?? []), ...(baseline.PasswordResetToken ?? [])].some((token) => !administrators.has(token.userId))) {
      throw new Error("Preserved authentication tokens must belong to baseline administrators.");
    }
  }
  if (!baseline.Product?.length || !baseline.ProductVariant?.length || !baseline.ProductImage?.length || !baseline.ProductCategory?.length) throw new Error("Imported catalog prerequisites are missing.");
  if (!baseline.PaymentMethodConfig?.some((row) => row.status === "ACTIVE") || !baseline.ShippingProvider?.some((row) => row.status === "ACTIVE") || !baseline.PickupPoint?.some((row) => row.status === "ACTIVE")) {
    throw new Error("Showcase requires active payment, shipping and pickup configuration; configuration repair is outside scope.");
  }
}

async function assertPersistencePrerequisites(tx: Prisma.TransactionClient): Promise<void> {
  const triggers = await tx.$queryRaw<{ name: string }[]>`SELECT t.tgname AS name FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal AND t.tgenabled IN ('O','A')`;
  for (const name of ["InventoryHistory_append_only", "Order_snapshot_immutable", "OrderItem_snapshot_immutable", "OrderPayment_snapshot_immutable"]) {
    if (!triggers.some((row) => row.name === name)) throw new Error("Showcase immutable persistence prerequisites are missing.");
  }
  const constraints = await tx.$queryRaw<{ name: string }[]>`SELECT conname AS name FROM pg_constraint WHERE connamespace='public'::regnamespace AND convalidated`;
  for (const name of ["Order_inventoryPolicy_inventoryEffectId_check", "OrderItem_line_subtotal_check", "ProductVariant_stockState_check", "InventoryHistory_compensatesMovementId_fkey"]) {
    if (!constraints.some((row) => row.name === name)) throw new Error("Showcase persistence constraints are missing.");
  }
}

export function json(value: unknown): Prisma.InputJsonValue { return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue; }
