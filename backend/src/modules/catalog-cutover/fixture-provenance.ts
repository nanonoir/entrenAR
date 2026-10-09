import { SHOWCASE_FIXTURE_MANIFEST } from "../showcase-reset/fixtures/showcase-fixture-manifest";
import { CUTOVER_BASIS, CUTOVER_CLASSIFICATION, type AuditEdge, type AuditRow, type CatalogSnapshot, type ClassifiedPopulation, type ForeignKeyEvidence, type OwnerAttestation, type SnapshotRecord } from "./cutover-contracts";
import { hashCanonical, SNAPSHOT_MODELS } from "./catalog-cutover.repository";

const CANDIDATE_MODELS = new Set([
  "Product", "ProductVariant", "ProductImage", "ProductCategory", "WishlistItem", "InventoryHistory",
  "Cart", "CartItem", "CheckoutSession", "CheckoutSessionHistory", "Order", "OrderItem", "OrderPayment",
  "OrderHistory", "CheckoutIdempotencyKey", "CouponRedemption", "PurchaseOrder", "PurchaseOrderItem", "Supplier",
  "Customer", "CustomerAddress", "UserAddress", "RefreshToken", "PasswordResetToken", "Coupon", "CouponCategory",
  "CouponProduct", "CouponHistory", "User",
]);

const JSON_REFERENCE_FIELDS = new Set(["productId", "variantId", "orderId", "cartId", "checkoutSessionId", "userId", "customerId"]);
const JSON_REFERENCE_TARGETS: Readonly<Record<string, readonly string[]>> = {
  productId: ["Product"], variantId: ["ProductVariant"], orderId: ["Order"], cartId: ["Cart"],
  checkoutSessionId: ["CheckoutSession"], userId: ["User"], customerId: ["Customer"],
};

export interface AttestationInput {
  owner: string;
  confirmedAt: string;
  statement: string;
  prdDigest: string;
}

export function classifyOwnerAttestedPopulation(
  snapshot: CatalogSnapshot,
  input: AttestationInput,
): ClassifiedPopulation {
  const blockers = [...snapshot.blockers];
  if (!input.owner.trim() || !input.statement.trim() || !isSha256(input.prdDigest) || !isIsoTimestamp(input.confirmedAt)) {
    blockers.push("OWNER_ATTESTATION_INVALID");
  }
  const rowBlockers = new Map<string, Set<string>>();
  const recordsByModel = new Map<string, SnapshotRecord[]>();
  for (const record of snapshot.records) append(recordsByModel, record.model, record);
  const userRoles = new Map((recordsByModel.get("User") ?? []).map((user) => [String(user.row["id"]), user.row["role"]]));
  for (const customer of recordsByModel.get("Customer") ?? []) {
    if (userRoles.get(String(customer.row["userId"])) === "ADMIN") addBlocker(rowBlockers, customer.ref, "MIXED_AUTHENTICATION_OWNERSHIP");
  }
  const candidates = snapshot.records.filter((record) => isCandidate(record, userRoles));
  const candidateRefs = new Set(candidates.map(({ ref }) => ref));
  const populationDigest = hashCanonical(candidates.map(({ model, ref, rowDigest }) => ({ model, ref, rowDigest })));
  const attestation: OwnerAttestation = {
    owner: input.owner,
    confirmedAt: input.confirmedAt,
    statement: input.statement,
    prdDigest: input.prdDigest,
    targetFingerprint: snapshot.targetFingerprint,
    auditId: snapshot.snapshotId,
    populationDigest,
  };
  const edges: AuditEdge[] = [];
  const primaryIndexes = buildPrimaryIndexes(snapshot.records);

  for (const foreignKey of snapshot.foreignKeys) {
    extractForeignKeyEdges(foreignKey, recordsByModel.get(foreignKey.fromModel) ?? [], primaryIndexes, edges, rowBlockers);
  }
  extractTypedColumnEdges(snapshot.records, primaryIndexes, rowBlockers, edges);
  for (const record of snapshot.records) extractJsonEdges(record, primaryIndexes, edges, rowBlockers);
  addOperationGroups(snapshot.records, edges);
  blockCustomerOwnersWithAdminSessions(recordsByModel, userRoles, rowBlockers);
  blockMixedOwnership(edges, new Map(snapshot.records.map((record) => [record.ref, record])), userRoles, rowBlockers);
  const selectedRefs = dependencyClosure(candidates, edges, rowBlockers);
  blockDependencyCycles(candidates, edges, rowBlockers);
  blockCompensationCycles(snapshot.records, edges, rowBlockers);

  const edgeRefs = new Map<string, Set<string>>();
  for (const edge of edges) {
    const fromRefs = edgeRefs.get(edge.from) ?? new Set<string>();
    const toRefs = edgeRefs.get(edge.to) ?? new Set<string>();
    fromRefs.add(edge.to);
    toRefs.add(edge.from);
    edgeRefs.set(edge.from, fromRefs);
    edgeRefs.set(edge.to, toRefs);
  }
  const rows = snapshot.records.map((record): AuditRow => {
    const candidate = candidateRefs.has(record.ref);
    const selected = selectedRefs.has(record.ref);
    const rowIssues = [...(rowBlockers.get(record.ref) ?? [])];
    return {
      model: record.model,
      ref: record.ref,
      rowDigest: record.rowDigest,
      classification: selected ? CUTOVER_CLASSIFICATION.MOCK : candidate ? CUTOVER_CLASSIFICATION.UNKNOWN : CUTOVER_CLASSIFICATION.PRESERVED,
      basis: selected ? CUTOVER_BASIS.OWNER_ATTESTATION : candidate ? CUTOVER_BASIS.UNKNOWN : CUTOVER_BASIS.POLICY,
      edgeRefs: [...(edgeRefs.get(record.ref) ?? [])].sort(),
      blockers: rowIssues,
    };
  });
  const fixtureSources = collectOptionalFixtureEvidence(recordsByModel);
  const allBlockers = [...new Set([...blockers, ...rowBlockers.values()].flatMap((value) => typeof value === "string" ? [value] : [...value]))];
  return {
    attestation,
    rows,
    edges: deduplicateEdges(edges),
    selectors: new Map(snapshot.records.filter((record) => selectedRefs.has(record.ref)).map((record) => [record.ref, record.row])),
    fixtureSources,
    blockers: allBlockers.sort(),
  };
}

function isCandidate(record: SnapshotRecord, userRoles: ReadonlyMap<string, unknown>): boolean {
  if (!CANDIDATE_MODELS.has(record.model)) return false;
  if (record.model === "User") return record.row["role"] === "CUSTOMER";
  if (["UserAddress", "RefreshToken", "PasswordResetToken"].includes(record.model)) {
    if (record.model === "RefreshToken" && record.row["sessionType"] !== "CUSTOMER") return false;
    return userRoles.get(String(record.row["userId"])) === "CUSTOMER";
  }
  return true;
}

function blockCustomerOwnersWithAdminSessions(
  recordsByModel: ReadonlyMap<string, readonly SnapshotRecord[]>,
  userRoles: ReadonlyMap<string, unknown>,
  blockers: Map<string, Set<string>>,
): void {
  const usersById = new Map((recordsByModel.get("User") ?? []).map((user) => [String(user.row["id"]), user]));
  for (const session of recordsByModel.get("RefreshToken") ?? []) {
    if (session.row["sessionType"] !== "ADMIN") continue;
    const ownerId = String(session.row["userId"]);
    if (userRoles.get(ownerId) !== "CUSTOMER") continue;
    const owner = usersById.get(ownerId);
    if (!owner) continue;
    addBlocker(blockers, owner.ref, "OUT_OF_SCOPE_DELETE_EFFECT");
    addBlocker(blockers, session.ref, "OUT_OF_SCOPE_DELETE_EFFECT");
  }
}

function buildPrimaryIndexes(records: readonly SnapshotRecord[]): Map<string, Map<string, SnapshotRecord>> {
  const indexes = new Map<string, Map<string, SnapshotRecord>>();
  for (const record of records) {
    const keyFields = SNAPSHOT_MODELS.find(({ name }) => name === record.model)?.primaryKey ?? [];
    const key = `${record.model}:${keyFields.join(",")}`;
    const index = indexes.get(key) ?? new Map<string, SnapshotRecord>();
    index.set(JSON.stringify(keyFields.map((field) => record.row[field])), record);
    indexes.set(key, index);
  }
  return indexes;
}

function extractForeignKeyEdges(
  foreignKey: ForeignKeyEvidence,
  records: readonly SnapshotRecord[],
  indexes: ReadonlyMap<string, ReadonlyMap<string, SnapshotRecord>>,
  edges: AuditEdge[],
  blockers: Map<string, Set<string>>,
): void {
  const targetFields = SNAPSHOT_MODELS.find(({ name }) => name === foreignKey.toModel)?.primaryKey;
  if (!targetFields || targetFields.length !== foreignKey.toFields.length || targetFields.some((field, index) => field !== foreignKey.toFields[index])) {
    for (const record of records.filter(({ model }) => model === foreignKey.fromModel)) addBlocker(blockers, record.ref, "UNMODELED_FOREIGN_KEY_TARGET");
    return;
  }
  const targetIndex = indexes.get(`${foreignKey.toModel}:${targetFields.join(",")}`);
  if (!targetIndex) return;
  for (const source of records.filter(({ model }) => model === foreignKey.fromModel)) {
    const values = foreignKey.fromFields.map((field) => source.row[field]);
    if (values.every((value) => value === null || value === undefined)) continue;
    if (values.some((value) => value === null || value === undefined)) {
      addBlocker(blockers, source.ref, "PARTIAL_FOREIGN_KEY_REFERENCE");
      continue;
    }
    const target = targetIndex.get(JSON.stringify(values));
    if (!target) {
      addBlocker(blockers, source.ref, "UNRESOLVED_FOREIGN_KEY_REFERENCE");
      continue;
    }
    edges.push({ from: target.ref, to: source.ref, field: foreignKey.fromFields.join(","), kind: "foreign-key", deleteEffect: foreignKey.deleteEffect });
  }
}

function extractJsonEdges(
  record: SnapshotRecord,
  indexes: ReadonlyMap<string, ReadonlyMap<string, SnapshotRecord>>,
  edges: AuditEdge[],
  blockers: Map<string, Set<string>>,
): void {
  const sources: unknown[] = [];
  if (record.model === "CheckoutSession") {
    const snapshot = record.row["snapshotData"];
    if (isRecord(snapshot) && snapshot["items"] !== undefined && !Array.isArray(snapshot["items"])) addBlocker(blockers, record.ref, "MALFORMED_SNAPSHOT_ITEMS");
    if (isRecord(snapshot) && Array.isArray(snapshot["items"])) sources.push(...snapshot["items"]);
  }
  if (record.model === "OrderItem") sources.push(record.row["snapshot"]);
  if (record.model === "CheckoutIdempotencyKey") sources.push(record.row["responseSnapshot"]);
  if (record.model === "CheckoutSessionHistory" || record.model === "OrderHistory") sources.push(record.row["metadata"]);
  for (const source of sources) {
    if (source === null || source === undefined) continue;
    if (typeof source === "string") {
      try { walkJsonReferences(JSON.parse(source) as unknown, record, indexes, edges, blockers); }
      catch { addBlocker(blockers, record.ref, "MALFORMED_JSON_REFERENCE_DATA"); }
    } else walkJsonReferences(source, record, indexes, edges, blockers);
  }
}

function extractTypedColumnEdges(
  records: readonly SnapshotRecord[],
  indexes: ReadonlyMap<string, ReadonlyMap<string, SnapshotRecord>>,
  blockers: Map<string, Set<string>>,
  edges: AuditEdge[],
): void {
  const byModel = new Map<string, SnapshotRecord[]>();
  for (const record of records) append(byModel, record.model, record);
  const ordersByEffect = new Map((byModel.get("Order") ?? []).filter((row) => typeof row.row["inventoryEffectId"] === "string").map((row) => [row.row["inventoryEffectId"] as string, row]));
  for (const record of records) {
    if (record.model === "OrderItem" || record.model === "PurchaseOrderItem") {
      addTypedEdge(record, "productId", "Product", record.row["productId"], indexes, blockers, edges);
      addTypedEdge(record, "variantId", "ProductVariant", record.row["variantId"], indexes, blockers, edges);
    }
    if (record.model === "Order" && typeof record.row["sourceOrderId"] === "string") {
      addTypedEdge(record, "sourceOrderId", "Order", record.row["sourceOrderId"], indexes, blockers, edges);
    }
    if (record.model === "InventoryHistory") {
      const referenceType = record.row["referenceType"];
      const targetModel = referenceType === "ORDER" ? "Order" : referenceType === "PURCHASE_ORDER" ? "PurchaseOrder" : undefined;
      if (targetModel) addTypedEdge(record, "referenceId", targetModel, record.row["referenceId"], indexes, blockers, edges);
      // RECONCILIATION referenceId is an operation label, not a relational row selector.
      const effectId = record.row["inventoryEffectId"];
      if (typeof effectId === "string") {
        const order = ordersByEffect.get(effectId);
        if (order) edges.push({ from: order.ref, to: record.ref, field: "inventoryEffectId", kind: "typed-reference", deleteEffect: "unknown" });
        // Historical fixture effects can outlive the order. An absent target has no deletion impact.
      }
    }
  }
}

function addTypedEdge(
  owner: SnapshotRecord,
  field: string,
  targetModel: string,
  value: unknown,
  indexes: ReadonlyMap<string, ReadonlyMap<string, SnapshotRecord>>,
  blockers: Map<string, Set<string>>,
  edges: AuditEdge[],
): void {
  if (value === null || value === undefined) return;
  if (typeof value !== "string") {
    addBlocker(blockers, owner.ref, "MALFORMED_TYPED_REFERENCE");
    return;
  }
  const target = indexes.get(`${targetModel}:id`)?.get(JSON.stringify([value]));
  if (!target) {
    if (!["InventoryHistory", "OrderItem", "PurchaseOrderItem"].includes(owner.model)) {
      addBlocker(blockers, owner.ref, "UNRESOLVED_TYPED_REFERENCE");
    }
    return;
  }
  edges.push({ from: target.ref, to: owner.ref, field, kind: "typed-reference", deleteEffect: "unknown" });
}

function walkJsonReferences(
  value: unknown,
  owner: SnapshotRecord,
  indexes: ReadonlyMap<string, ReadonlyMap<string, SnapshotRecord>>,
  edges: AuditEdge[],
  blockers: Map<string, Set<string>>,
): void {
  if (Array.isArray(value)) {
    value.forEach((child) => walkJsonReferences(child, owner, indexes, edges, blockers));
    return;
  }
  if (!isRecord(value)) return;
  for (const [field, child] of Object.entries(value)) {
    if (JSON_REFERENCE_FIELDS.has(field) && typeof child === "string") {
      const targets = JSON_REFERENCE_TARGETS[field] ?? [];
      const matches = targets.flatMap((model) => {
        const target = indexes.get(`${model}:id`)?.get(JSON.stringify([child]));
        return target ? [target] : [];
      });
      if (matches.length !== 1) addBlocker(blockers, owner.ref, matches.length ? "AMBIGUOUS_JSON_REFERENCE" : "UNRESOLVED_JSON_REFERENCE");
      else edges.push({ from: matches[0]!.ref, to: owner.ref, field, kind: "typed-reference", deleteEffect: "unknown" });
    } else if (JSON_REFERENCE_FIELDS.has(field) && child !== null && child !== undefined && typeof child !== "string") {
      addBlocker(blockers, owner.ref, "MALFORMED_JSON_REFERENCE");
    }
    walkJsonReferences(child, owner, indexes, edges, blockers);
  }
}

function addOperationGroups(records: readonly SnapshotRecord[], edges: AuditEdge[]): void {
  const groups = new Map<string, SnapshotRecord[]>();
  for (const record of records) {
    if (record.model !== "InventoryHistory" || typeof record.row["operationId"] !== "string") continue;
    const key = record.row["operationId"] as string;
    append(groups, key, record);
  }
  for (const group of groups.values()) {
    for (const left of group) for (const right of group) {
      if (left.ref < right.ref) edges.push({ from: left.ref, to: right.ref, field: "operationId", kind: "group", deleteEffect: "unknown" });
    }
  }
}

function dependencyClosure(
  candidates: readonly SnapshotRecord[],
  edges: readonly AuditEdge[],
  blockers: Map<string, Set<string>>,
): Set<string> {
  const candidateRefs = new Set(candidates.map(({ ref }) => ref));
  // Owner attestation covers every enumerated commercial row, including disconnected idempotency records.
  const selected = new Set(candidates.map(({ ref }) => ref));
  const dependants = new Map<string, string[]>();
    for (const edge of edges) append(dependants, edge.from, edge.to);
  const queue = [...selected];
  for (let index = 0; index < queue.length; index += 1) {
    for (const child of dependants.get(queue[index]!) ?? []) {
      if (!candidateRefs.has(child) || selected.has(child)) continue;
      selected.add(child);
      queue.push(child);
    }
  }
  for (const candidate of candidates) if (!selected.has(candidate.ref)) addBlocker(blockers, candidate.ref, "CANDIDATE_OUTSIDE_DEPENDENCY_CLOSURE");
  return selected;
}

function blockCompensationCycles(records: readonly SnapshotRecord[], edges: readonly AuditEdge[], blockers: Map<string, Set<string>>): void {
  const inventoryRefs = new Set(records.filter(({ model }) => model === "InventoryHistory").map(({ ref }) => ref));
  const graph = new Map<string, Set<string>>();
  const indegree = new Map([...inventoryRefs].map((ref) => [ref, 0]));
  for (const edge of edges) {
    if (edge.field !== "compensatesMovementId") continue;
    const children = graph.get(edge.from) ?? new Set<string>();
    if (!children.has(edge.to)) indegree.set(edge.to, (indegree.get(edge.to) ?? 0) + 1);
    children.add(edge.to);
    graph.set(edge.from, children);
  }
  const queue = [...indegree].filter(([, count]) => count === 0).map(([ref]) => ref);
  const processed = new Set<string>();
  for (let index = 0; index < queue.length; index += 1) {
    const ref = queue[index]!;
    processed.add(ref);
    for (const child of graph.get(ref) ?? []) {
      const remaining = (indegree.get(child) ?? 0) - 1;
      indegree.set(child, remaining);
      if (remaining === 0) queue.push(child);
    }
  }
  for (const ref of inventoryRefs) if (!processed.has(ref)) addBlocker(blockers, ref, "INVENTORY_COMPENSATION_CYCLE");
}

function blockDependencyCycles(candidates: readonly SnapshotRecord[], edges: readonly AuditEdge[], blockers: Map<string, Set<string>>): void {
  const candidateRefs = new Set(candidates.map(({ ref }) => ref));
  const dependants = new Map<string, Set<string>>();
  const indegree = new Map([...candidateRefs].map((ref) => [ref, 0]));
  for (const edge of edges) {
    if (edge.kind === "group" || !candidateRefs.has(edge.from) || !candidateRefs.has(edge.to)) continue;
    const children = dependants.get(edge.from) ?? new Set<string>();
    if (!children.has(edge.to)) indegree.set(edge.to, (indegree.get(edge.to) ?? 0) + 1);
    children.add(edge.to);
    dependants.set(edge.from, children);
  }
  const queue = [...indegree].filter(([, count]) => count === 0).map(([ref]) => ref);
  const visited = new Set<string>();
  for (let index = 0; index < queue.length; index += 1) {
    const ref = queue[index]!;
    visited.add(ref);
    for (const child of dependants.get(ref) ?? []) {
      const remaining = (indegree.get(child) ?? 0) - 1;
      indegree.set(child, remaining);
      if (remaining === 0) queue.push(child);
    }
  }
  for (const ref of candidateRefs) if (!visited.has(ref)) addBlocker(blockers, ref, "DEPENDENCY_CYCLE_UNSCHEDULABLE");
}

function blockMixedOwnership(
  edges: readonly AuditEdge[],
  records: ReadonlyMap<string, SnapshotRecord>,
  userRoles: ReadonlyMap<string, unknown>,
  blockers: Map<string, Set<string>>,
): void {
  for (const edge of edges) {
    const parent = records.get(edge.from);
    const child = records.get(edge.to);
    if (!parent || !child) continue;
    const targetWillBeDeleted = isCandidate(parent, userRoles);
    const dependentWillBeDeleted = isCandidate(child, userRoles);
    if (targetWillBeDeleted && !dependentWillBeDeleted) {
      addBlocker(blockers, parent.ref, "OUT_OF_SCOPE_DELETE_EFFECT");
      addBlocker(blockers, child.ref, "OUT_OF_SCOPE_DELETE_EFFECT");
    }
  }
}

function collectOptionalFixtureEvidence(records: ReadonlyMap<string, SnapshotRecord[]>): string[] {
  const available: string[] = [];
  const families = SHOWCASE_FIXTURE_MANIFEST.families;
  for (const family of Object.keys(families) as Array<keyof typeof families>) {
    const models = families[family].models;
    for (const model of Object.keys(models)) {
      const ids = models[model] ?? [];
      const modelName = capitalize(model);
      const keyFields = modelName === "CustomerAddress" ? ["customerId"] : SNAPSHOT_MODELS.find(({ name }) => name === modelName)?.primaryKey ?? ["id"];
      const existing = new Set((records.get(modelName) ?? []).map((record) => keyFields.map((field) => String(record.row[field])).join(":")));
      if (ids.some((id) => existing.has(id))) available.push(`${family}:${model}`);
    }
  }
  return available.sort();
}

function addBlocker(blockers: Map<string, Set<string>>, ref: string, reason: string): void {
  blockers.set(ref, new Set([...(blockers.get(ref) ?? []), reason]));
}

function append<T>(map: Map<string, T[]>, key: string, value: T): void {
  const values = map.get(key);
  if (values) values.push(value);
  else map.set(key, [value]);
}

function deduplicateEdges(edges: readonly AuditEdge[]): AuditEdge[] {
  const unique = new Map(edges.map((edge) => [`${edge.from}|${edge.to}|${edge.field}|${edge.kind}|${edge.deleteEffect}`, edge]));
  return [...unique.values()].sort((left, right) => left.from.localeCompare(right.from) || left.to.localeCompare(right.to) || left.field.localeCompare(right.field));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSha256(value: string): boolean { return /^[a-f0-9]{64}$/i.test(value); }
function isIsoTimestamp(value: string): boolean { return !Number.isNaN(Date.parse(value)) && new Date(value).toISOString() === value; }
function capitalize(value: string): string { return value.charAt(0).toUpperCase() + value.slice(1); }

export function attestationDigest(attestation: OwnerAttestation): string {
  return hashCanonical(attestation);
}

export function candidatePopulationDigest(snapshot: CatalogSnapshot): string {
  const userRoles = new Map(snapshot.records.filter(({ model }) => model === "User").map((user) => [String(user.row["id"]), user.row["role"]]));
  return hashCanonical(snapshot.records.filter((record) => isCandidate(record, userRoles)).map(({ model, ref, rowDigest }) => ({ model, ref, rowDigest })));
}
