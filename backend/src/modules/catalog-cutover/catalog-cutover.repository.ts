import { createHash, createHmac, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Prisma } from "../../generated/prisma/client";
import type { PrismaService } from "../../common/prisma/prisma.service";
import { MutationGate } from "../../common/prisma/mutation-gate";
import { identifyDatabaseTarget } from "../catalog-scraper/operations/database-target";
import type { AuditEdge, CatalogSnapshot, ForeignKeyEvidence, SnapshotRecord } from "./cutover-contracts";
import { withScopedLedgerDeletion } from "./scoped-ledger-deletion";

export const SNAPSHOT_PAGE_SIZE = 500;
export const REQUIRED_CANONICAL_CATEGORY_COUNT = 61;

interface ModelDefinition {
  name: string;
  primaryKey: readonly string[];
}

export const SNAPSHOT_MODELS: readonly ModelDefinition[] = [
  { name: "User", primaryKey: ["id"] }, { name: "Customer", primaryKey: ["id"] },
  { name: "CustomerAddress", primaryKey: ["id"] }, { name: "RefreshToken", primaryKey: ["id"] },
  { name: "UserAddress", primaryKey: ["id"] }, { name: "WishlistItem", primaryKey: ["userId", "productId"] },
  { name: "PasswordResetToken", primaryKey: ["id"] }, { name: "Category", primaryKey: ["id"] },
  { name: "Product", primaryKey: ["id"] }, { name: "ProductVariant", primaryKey: ["id"] },
  { name: "ProductImage", primaryKey: ["id"] }, { name: "ProductCategory", primaryKey: ["productId", "categoryId"] },
  { name: "InventoryHistory", primaryKey: ["id"] }, { name: "CatalogSettings", primaryKey: ["id"] },
  { name: "PaymentMethodConfig", primaryKey: ["id"] }, { name: "ShippingProvider", primaryKey: ["id"] },
  { name: "WeightBand", primaryKey: ["id"] }, { name: "PickupPoint", primaryKey: ["id"] },
  { name: "PickupPointSchedule", primaryKey: ["id"] }, { name: "Coupon", primaryKey: ["id"] },
  { name: "CouponCategory", primaryKey: ["couponId", "categoryId"] }, { name: "CouponProduct", primaryKey: ["couponId", "productId"] },
  { name: "CouponHistory", primaryKey: ["id"] }, { name: "ShippingDiscount", primaryKey: ["id"] },
  { name: "ShippingDiscountCategory", primaryKey: ["shippingDiscountId", "categoryId"] },
  { name: "Cart", primaryKey: ["id"] }, { name: "CartItem", primaryKey: ["id"] },
  { name: "CheckoutSession", primaryKey: ["id"] }, { name: "CheckoutSessionHistory", primaryKey: ["id"] },
  { name: "CartRecoverySettings", primaryKey: ["id"] }, { name: "Order", primaryKey: ["id"] },
  { name: "OrderItem", primaryKey: ["id"] }, { name: "OrderPayment", primaryKey: ["id"] },
  { name: "OrderHistory", primaryKey: ["id"] }, { name: "Supplier", primaryKey: ["id"] },
  { name: "PurchaseOrder", primaryKey: ["id"] }, { name: "PurchaseOrderItem", primaryKey: ["id"] },
  { name: "CheckoutIdempotencyKey", primaryKey: ["id"] }, { name: "CouponRedemption", primaryKey: ["id"] },
];

interface RawRow {
  row: Record<string, unknown>;
}

interface RawForeignKey {
  constraint: string;
  fromModel: string;
  fromField: string;
  toModel: string;
  toField: string;
  deleteEffect: string;
  position: number;
}

export interface ApprovedDeletionSelector {
  model: string;
  ref: string;
  fields: readonly string[];
  values: readonly string[];
}

export interface CleanupRepositoryInput {
  targetFingerprint: string;
  populationDigest: string;
  foreignKeyDigest: string;
  selectedRefs: readonly string[];
  selectors: readonly ApprovedDeletionSelector[];
  edges: readonly AuditEdge[];
  preservedDigest: string;
}

export interface CleanupRepositoryReceipt {
  auditDigest: string;
  targetFingerprint: string;
  deletedCount: number;
  preservedDigest: string;
  completedAt: string;
}

export class CatalogCutoverRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hmacKey: string,
    private readonly targetFingerprint: () => string = () => identifyDatabaseTarget().fingerprint,
    private readonly mutationGate = new MutationGate(),
  ) {
    if (hmacKey.length < 32) throw new Error("Cutover evidence key must contain at least 32 characters.");
  }

  async readSnapshot(): Promise<CatalogSnapshot> {
    const schemaText = await readPrismaSchema();
    const expectedForeignKeys = parseSchemaForeignKeys(schemaText);
    return this.prisma.$transaction(async (transaction) => {
      return this.readSnapshotTransaction(transaction, expectedForeignKeys);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }

  async cleanupApproved(input: CleanupRepositoryInput): Promise<CleanupRepositoryReceipt> {
    const expectedForeignKeys = parseSchemaForeignKeys(await readPrismaSchema());
    return this.mutationGate.runExclusive(this.prisma, async (transaction) => {
      for (const model of [...SNAPSHOT_MODELS].map(({ name }) => name).sort()) {
        await transaction.$executeRaw(Prisma.raw(`LOCK TABLE ${quoteIdentifier(model)} IN ACCESS EXCLUSIVE MODE`));
      }
      const before = await this.readSnapshotTransaction(transaction, expectedForeignKeys);
      if (before.targetFingerprint !== input.targetFingerprint || before.populationDigest !== input.populationDigest || hashCanonical(before.foreignKeys) !== input.foreignKeyDigest || before.blockers.length > 0) {
        throw new Error("Cutover scope or target drifted after approval.");
      }
      const selectors = validateDeletionSelectors(input.selectors, input.selectedRefs);
      const auditedRows = new Map(before.records.map((record) => [record.ref, record]));
      for (const selector of selectors) {
        const audited = auditedRows.get(selector.ref);
        if (!audited || audited.model !== selector.model || selector.fields.some((field, index) => String(audited.row[field]) !== selector.values[index])) {
          throw new Error("Deletion selector differs from its audited row.");
        }
      }
      const order = topologicalDeletionOrder(input.selectedRefs, input.edges);
      const byRef = new Map(selectors.map((selector) => [selector.ref, selector]));
      const ledgerIds = selectors.filter(({ model }) => model === "InventoryHistory").map(({ values }) => values[0]!);
      await withScopedLedgerDeletion(transaction, ledgerIds, async () => {
        for (const ref of order) {
          const selector = byRef.get(ref);
          if (!selector) throw new Error("Approved deletion selector is incomplete.");
          const deleted = await deleteSelectedRow(transaction, selector);
          if (deleted !== 1) throw new Error("Approved row changed during atomic cleanup.");
        }
      });
      const after = await this.readSnapshotTransaction(transaction, expectedForeignKeys);
      const selectedRefSet = new Set(input.selectedRefs);
      if (after.blockers.length > 0 || after.records.some(({ ref }) => selectedRefSet.has(ref))) throw new Error("Approved rows remain after cleanup.");
      if ((after.counts["Product"] ?? -1) !== 0 || (after.counts["Category"] ?? -1) !== REQUIRED_CANONICAL_CATEGORY_COUNT) throw new Error("Catalog or canonical category reconciliation failed.");
      const preservedDigest = preservedPopulationDigest(after.records);
      if (preservedDigest !== input.preservedDigest) throw new Error("Preserved state changed during cleanup.");
      return {
        auditDigest: input.populationDigest, targetFingerprint: before.targetFingerprint,
        deletedCount: selectors.length, preservedDigest, completedAt: new Date().toISOString(),
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 120_000, timeout: 120_000 });
  }

  private async readSnapshotTransaction(
    transaction: Prisma.TransactionClient,
    expectedForeignKeys: readonly ForeignKeyEvidence[],
  ): Promise<CatalogSnapshot> {
      const records: SnapshotRecord[] = [];
      const counts: Record<string, number> = {};
      const blockers: string[] = [];
      for (const model of SNAPSHOT_MODELS) {
        const countRows = await transaction.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
          SELECT count(*)::bigint AS count FROM ${Prisma.raw(quoteIdentifier(model.name))}
        `);
        const expectedCount = Number(countRows[0]?.count ?? 0n);
        let cursor: readonly string[] | undefined;
        let observedCount = 0;
        while (true) {
          const page = await this.readPage(transaction, model, cursor);
          if (page.length === 0) break;
          observedCount += page.length;
          for (const { row } of page) records.push(this.record(model, row));
          cursor = model.primaryKey.map((field) => String(page[page.length - 1]!.row[field]));
          if (page.length < SNAPSHOT_PAGE_SIZE) break;
        }
        counts[model.name] = observedCount;
        if (observedCount !== expectedCount) blockers.push(`SNAPSHOT_COUNT_MISMATCH:${model.name}`);
      }
      const foreignKeys = await this.readForeignKeys(transaction);
      blockers.push(...compareForeignKeys(expectedForeignKeys, foreignKeys));
      const ordered = records.toSorted((left, right) => left.model.localeCompare(right.model) || left.ref.localeCompare(right.ref));
      const populationDigest = hashCanonical(ordered.map(({ model, ref, rowDigest }) => ({ model, ref, rowDigest })));
      return {
        snapshotId: randomUUID(), targetFingerprint: this.targetFingerprint(), schema: "public",
        populationDigest, counts, records: ordered, foreignKeys, blockers,
      };
  }

  private async readPage(
    transaction: Prisma.TransactionClient,
    model: ModelDefinition,
    cursor?: readonly string[],
  ): Promise<RawRow[]> {
    const table = Prisma.raw(`"${model.name}"`);
    const columns = model.primaryKey.map((field) => Prisma.raw(`page_row."${field}"`));
    const where = cursor ? Prisma.sql`WHERE (${Prisma.join(columns)}) > (${Prisma.join(cursor)})` : Prisma.empty;
    return transaction.$queryRaw<RawRow[]>(Prisma.sql`
      SELECT to_jsonb(page_row) AS row FROM ${table} AS page_row
      ${where}
      ORDER BY ${Prisma.join(columns)}
      LIMIT ${SNAPSHOT_PAGE_SIZE}
    `);
  }

  private async readForeignKeys(transaction: Prisma.TransactionClient): Promise<ForeignKeyEvidence[]> {
    const rows = await transaction.$queryRaw<RawForeignKey[]>(Prisma.sql`
      SELECT c.conname::text AS "constraint", src.relname::text AS "fromModel", src_col.attname::text AS "fromField",
             dst.relname::text AS "toModel", dst_col.attname::text AS "toField", c.confdeltype::text AS "deleteEffect",
             keys.position AS "position"
      FROM pg_constraint c
      JOIN pg_class src ON src.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = src.relnamespace AND n.nspname = 'public'
      JOIN pg_class dst ON dst.oid = c.confrelid
      JOIN LATERAL unnest(c.conkey, c.confkey) WITH ORDINALITY AS keys(src_attnum, dst_attnum, position) ON true
      JOIN pg_attribute src_col ON src_col.attrelid = src.oid AND src_col.attnum = keys.src_attnum
      JOIN pg_attribute dst_col ON dst_col.attrelid = dst.oid AND dst_col.attnum = keys.dst_attnum
      WHERE c.contype = 'f'
      ORDER BY src.relname, c.conname, keys.position
    `);
    const grouped = new Map<string, RawForeignKey[]>();
    for (const row of rows) {
      const key = `${row.fromModel}:${row.constraint}`;
      const parts = grouped.get(key);
      if (parts) parts.push(row);
      else grouped.set(key, [row]);
    }
    return [...grouped.values()].map((parts) => {
      const first = parts[0]!;
      return {
        constraint: first.constraint,
        fromModel: first.fromModel,
        fromFields: parts.map((part) => part.fromField),
        toModel: first.toModel,
        toFields: parts.map((part) => part.toField),
        deleteEffect: mapDeleteEffect(first.deleteEffect),
      };
    });
  }

  private record(model: ModelDefinition, row: Record<string, unknown>): SnapshotRecord {
    const key = model.primaryKey.map((field) => row[field]);
    if (key.some((value) => value === null || value === undefined)) throw new Error(`Snapshot key is missing for ${model.name}.`);
    const canonicalRow = canonicalize(row);
    const serializedKey = JSON.stringify(key);
    return {
      model: model.name,
      ref: createHmac("sha256", this.hmacKey).update(`${model.name}:${serializedKey}`).digest("hex"),
      rowDigest: createHmac("sha256", this.hmacKey).update(JSON.stringify(canonicalRow)).digest("hex"),
      row,
    };
  }
}

export function preservedPopulationDigest(records: readonly SnapshotRecord[]): string {
  return hashCanonical(records.map(({ model, ref, rowDigest }) => ({ model, ref, rowDigest })).sort((left, right) => left.model.localeCompare(right.model) || left.ref.localeCompare(right.ref)));
}

function validateDeletionSelectors(selectors: readonly ApprovedDeletionSelector[], selectedRefs: readonly string[]): ApprovedDeletionSelector[] {
  if (new Set(selectedRefs).size !== selectedRefs.length || selectors.length !== selectedRefs.length) throw new Error("Deletion selectors do not exactly match the approved scope.");
  const modelByName = new Map(SNAPSHOT_MODELS.map((model) => [model.name, model]));
  const selected = new Set(selectedRefs);
  for (const selector of selectors) {
    const expectedFields = selector.model === "CustomerAddress" ? ["customerId"] : modelByName.get(selector.model)?.primaryKey;
    if (!expectedFields || JSON.stringify(expectedFields) !== JSON.stringify(selector.fields) || selector.values.length !== selector.fields.length || selector.values.some((value) => !value)) {
      throw new Error("Unsafe or incomplete deletion selector.");
    }
  }
  const selectorRefs = new Set(selectors.map(({ ref }) => ref));
  if (selectorRefs.size !== selected.size || [...selected].some((ref) => !selectorRefs.has(ref))) {
    throw new Error("Deletion selector references do not match approved rows.");
  }
  return [...selectors];
}

function topologicalDeletionOrder(selectedRefs: readonly string[], edges: readonly AuditEdge[]): string[] {
  const selected = new Set(selectedRefs);
  const dependants = new Map<string, Set<string>>();
  const parentsByDependent = new Map<string, Set<string>>();
  for (const edge of edges) {
    if (edge.kind === "group" || !selected.has(edge.from) || !selected.has(edge.to)) continue;
    const children = dependants.get(edge.from) ?? new Set<string>();
    const parents = parentsByDependent.get(edge.to) ?? new Set<string>();
    children.add(edge.to);
    parents.add(edge.from);
    dependants.set(edge.from, children);
    parentsByDependent.set(edge.to, parents);
  }
  const remainingDependants = new Map([...selected].map((ref) => [ref, dependants.get(ref)?.size ?? 0]));
  const ready = [...remainingDependants].filter(([, count]) => count === 0).map(([ref]) => ref).sort();
  const ordered: string[] = [];
  for (let index = 0; index < ready.length; index += 1) {
    const ref = ready[index]!;
    ordered.push(ref);
    for (const parent of parentsByDependent.get(ref) ?? []) {
      const remaining = (remainingDependants.get(parent) ?? 0) - 1;
      remainingDependants.set(parent, remaining);
      if (remaining === 0) ready.push(parent);
    }
  }
  if (ordered.length !== selected.size) throw new Error("Approved deletion dependency cycle cannot be scheduled.");
  return ordered;
}

async function deleteSelectedRow(transaction: Prisma.TransactionClient, selector: ApprovedDeletionSelector): Promise<number> {
  const conditions = selector.fields.map((field, index) => Prisma.sql`${Prisma.raw(quoteIdentifier(field))} = ${selector.values[index]}`);
  return transaction.$executeRaw(Prisma.sql`DELETE FROM ${Prisma.raw(quoteIdentifier(selector.model))} WHERE ${Prisma.join(conditions, " AND ")}`);
}

async function readPrismaSchema(): Promise<string> {
  for (const schemaPath of [
    resolve(__dirname, "../../../prisma/schema.prisma"),
    resolve(__dirname, "../../../../prisma/schema.prisma"),
  ]) {
    try { return await readFile(schemaPath, "utf8"); }
    catch (error) {
      if (typeof error !== "object" || error === null || !("code" in error) || error.code !== "ENOENT") throw error;
    }
  }
  throw new Error("Canonical Prisma schema is unavailable for cutover review.");
}

export function parseSchemaForeignKeys(schemaText: string): ForeignKeyEvidence[] {
  const foreignKeys: ForeignKeyEvidence[] = [];
  for (const modelMatch of schemaText.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)) {
    const fromModel = modelMatch[1]!;
    const body = modelMatch[2]!;
    for (const line of body.split(/\r?\n/)) {
      const relation = /@relation\(([^)]*)\)/.exec(line)?.[1];
      if (!relation) continue;
      const fields = /fields:\s*\[([^\]]+)\]/.exec(relation)?.[1]?.split(",").map((field) => field.trim()).filter(Boolean);
      const toFields = /references:\s*\[([^\]]+)\]/.exec(relation)?.[1]?.split(",").map((field) => field.trim()).filter(Boolean);
      if (!fields?.length || !toFields?.length) continue;
      const toModel = /^\s*\w+\s+(\w+)\??\s/.exec(line)?.[1];
      if (!toModel || fields.length !== toFields.length) throw new Error(`Invalid Prisma relation declaration in ${fromModel}.`);
      const onDelete = /onDelete:\s*(Cascade|SetNull|Restrict|NoAction)/.exec(relation)?.[1];
      if (!onDelete) throw new Error(`Prisma relation ${fromModel}.${fields.join(",")} must declare onDelete for cutover review.`);
      foreignKeys.push({ constraint: `${fromModel}.${fields.join(",")}`, fromModel, fromFields: fields, toModel, toFields, deleteEffect: onDelete as ForeignKeyEvidence["deleteEffect"] });
    }
  }
  return foreignKeys.sort(compareForeignKeySignature);
}

export function compareForeignKeys(expected: readonly ForeignKeyEvidence[], actual: readonly ForeignKeyEvidence[]): string[] {
  const signature = (foreignKey: ForeignKeyEvidence) => `${foreignKey.fromModel}:${foreignKey.fromFields.join(",")}>${foreignKey.toModel}:${foreignKey.toFields.join(",")}:${foreignKey.deleteEffect}`;
  const expectedSet = new Set(expected.map(signature));
  const actualSet = new Set(actual.map(signature));
  return [
    ...[...expectedSet].filter((entry) => !actualSet.has(entry)).map(() => "SCHEMA_FOREIGN_KEY_MISSING"),
    ...[...actualSet].filter((entry) => !expectedSet.has(entry)).map(() => "UNMODELED_FOREIGN_KEY_EFFECT"),
  ];
}

export function hashCanonical(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex");
}

export function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value !== "object" || value === null) return value;
  if (value instanceof Date) return value.toISOString();
  const sorted = Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
  return Object.fromEntries(sorted.map(([key, child]) => [key, canonicalize(child)]));
}

function quoteIdentifier(identifier: string): string {
  if (!/^[A-Za-z][A-Za-z0-9]*$/.test(identifier)) throw new Error("Unsafe schema identifier.");
  return `"${identifier}"`;
}

function mapDeleteEffect(value: string): ForeignKeyEvidence["deleteEffect"] {
  if (value === "c") return "Cascade";
  if (value === "n") return "SetNull";
  if (value === "r") return "Restrict";
  if (value === "a") return "NoAction";
  return "unknown";
}

function compareForeignKeySignature(left: ForeignKeyEvidence, right: ForeignKeyEvidence): number {
  return `${left.fromModel}:${left.fromFields.join(",")}`.localeCompare(`${right.fromModel}:${right.fromFields.join(",")}`);
}
