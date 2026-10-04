import { createHash, randomUUID } from "node:crypto";
import { open, readFile, realpath } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { identifyDatabaseTarget, type DatabaseTargetIdentity } from "./database-target";

type Row = Record<string, unknown>;
export interface ShakerSql {
  query(sql: string, values?: unknown[]): Promise<{ rows: Row[]; rowCount: number | null }>;
}
export interface ShakerSnapshot {
  target: DatabaseTargetIdentity;
  connected?: Row;
  categories: Row[];
  links: Row[];
  counts: Record<string, number>;
  invariants: Record<string, string>;
  references: Row[];
}
export interface ShakerBackup {
  version: number;
  createdAt: string;
  before: ShakerSnapshot;
  additions: Row[];
  after: ShakerSnapshot;
}
export interface ShakerReceipt {
  added: number;
  removed: number;
  deleted: number;
  noop: boolean;
  snapshotHash: string;
}
export function shakerHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
function same(left: unknown, right: unknown): boolean { return shakerHash(left) === shakerHash(right); }
function ordered(rows: Row[]): Row[] {
  return [...rows].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}
function category(snapshot: ShakerSnapshot, slug: string): Row {
  const rows = snapshot.categories.filter((row) => row["slug"] === slug);
  if (rows.length !== 1) throw new Error("Required category is missing or ambiguous.");
  return rows[0]!;
}
function memberships(snapshot: ShakerSnapshot, id: unknown): Row[] {
  return snapshot.links.filter((row) => row["categoryId"] === id);
}
export function assertShakerTarget(target: DatabaseTargetIdentity, confirmedFingerprint: string): void {
  if (target.host !== "127.0.0.1" || target.port !== 5432 || target.database !== "entrenar" ||
    target.schema !== "public" || target.fingerprint !== confirmedFingerprint ||
    (target.hostAddress && target.hostAddress !== "127.0.0.1")) throw new Error("Unconfirmed existing local target.");
}
export function planShakerConsolidation(before: ShakerSnapshot): ShakerBackup {
  const root = category(before, "shakers");
  const obsolete = category(before, "shakers-y-botellas");
  const rootLinks = memberships(before, root["id"]);
  const oldLinks = memberships(before, obsolete["id"]);
  const keys = before.links.map((row) => JSON.stringify([row["productId"], row["categoryId"]]));
  if (new Set(keys).size !== keys.length || root["parentId"] !== null ||
    before.categories.some((row) => row["parentId"] === obsolete["id"])) throw new Error("Category or duplicate drift.");
  const expected = { Product: 649, ProductVariant: 1119, ProductImage: 3790, Category: 61, ProductCategory: 2124 };
  if (Object.entries(expected).some(([table, count]) => before.counts[table] !== count) ||
    rootLinks.length !== 19 || oldLinks.length !== 23) throw new Error("Baseline drift.");
  const additions = oldLinks.filter((row) => !rootLinks.some((link) => link["productId"] === row["productId"]))
    .map((row) => ({ ...row, categoryId: root["id"] }));
  if (additions.length !== 4) throw new Error("Membership union drift.");
  const after = { ...before, categories: before.categories.filter((row) => row["id"] !== obsolete["id"]),
    links: ordered([...before.links.filter((row) => row["categoryId"] !== obsolete["id"]), ...additions]),
    counts: { ...before.counts, Category: 60, ProductCategory: 2105 } };
  return { version: 1, createdAt: new Date().toISOString(), before, additions: ordered(additions), after };
}

// Only credential-free destination evidence and hashes of protected rows leave this reader.
export async function readShakerSnapshot(db: ShakerSql, target: DatabaseTargetIdentity): Promise<ShakerSnapshot> {
  const identity = (await db.query(`SELECT current_database() AS database, current_schema() AS schema,
    inet_server_addr()::text AS address, inet_server_port() AS port`)).rows[0];
  if (!identity || identity["database"] !== target.database || identity["schema"] !== target.schema ||
    identity["port"] !== target.port || !identity["address"]) {
    throw new Error("Connected target mismatch.");
  }
  const references = ordered((await db.query(`SELECT ns.nspname AS schema, rel.relname AS table,
    att.attname AS column, refatt.attname AS target_column, cardinality(c.conkey) AS width
    FROM pg_constraint c JOIN pg_class rel ON rel.oid=c.conrelid
    JOIN pg_namespace ns ON ns.oid=rel.relnamespace
    JOIN pg_attribute att ON att.attrelid=c.conrelid AND att.attnum=c.conkey[1]
    JOIN pg_attribute refatt ON refatt.attrelid=c.confrelid AND refatt.attnum=c.confkey[1]
    WHERE c.contype='f' AND c.confrelid='public."Category"'::regclass`)).rows);
  const expected = ["Category:parentId", "ProductCategory:categoryId", "CouponCategory:categoryId", "ShippingDiscountCategory:categoryId"].sort();
  if (!same(references.map((row) => `${row["table"]}:${row["column"]}`).sort(), expected) ||
    references.some((row) => row["schema"] !== "public" || row["width"] !== 1 || row["target_column"] !== "id")) {
    throw new Error("Unknown category references.");
  }
  if ((await db.query(`SELECT 1 FROM pg_trigger WHERE NOT tgisinternal AND
    tgrelid IN ('public."Category"'::regclass, 'public."ProductCategory"'::regclass)`)).rows.length) {
    throw new Error("Unknown mutation triggers.");
  }
  const tables = (await db.query(`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`)).rows;
  const counts: Record<string, number> = {};
  const invariants: Record<string, string> = {};
  let categories: Row[] = [];
  let links: Row[] = [];
  for (const entry of tables) {
    const table = String(entry["tablename"]);
    const quoted = '"' + table.replace(/"/g, '""') + '"';
    const rows = ordered((await db.query(`SELECT to_jsonb(t) AS row FROM public.${quoted} t ORDER BY to_jsonb(t)::text`)).rows.map((row) => row["row"] as Row));
    counts[table] = rows.length;
    if (table === "Category") categories = rows;
    else if (table === "ProductCategory") links = rows;
    else invariants[table] = shakerHash(rows);
  }
  const obsolete = categories.find((row) => row["slug"] === "shakers-y-botellas");
  if (obsolete) {
    for (const table of ["CouponCategory", "ShippingDiscountCategory"]) {
      if ((await db.query(`SELECT 1 FROM public."${table}" WHERE "categoryId"=$1 LIMIT 1`, [obsolete["id"]])).rows.length) {
        throw new Error("Obsolete category has protected references.");
      }
    }
  }
  return { target, connected: identity, categories, links, counts, invariants, references };
}

async function transaction<T>(db: ShakerSql, readonly: boolean, work: () => Promise<T>): Promise<T> {
  await db.query(readonly ? "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY" : "BEGIN ISOLATION LEVEL SERIALIZABLE");
  try {
    await db.query("SET LOCAL statement_timeout = '5s'");
    await db.query("SET LOCAL lock_timeout = '5s'");
    await db.query("SET LOCAL idle_in_transaction_session_timeout = '5s'");
    if (!readonly) {
      await db.query('LOCK TABLE public."Category", public."ProductCategory", public."CouponCategory", public."ShippingDiscountCategory" IN SHARE ROW EXCLUSIVE MODE');
      await db.query(`SELECT id FROM public."Category" WHERE slug IN ('shakers','shakers-y-botellas') FOR UPDATE`);
    }
    const result = await work();
    await db.query("COMMIT");
    return result;
  } catch (error) { await db.query("ROLLBACK"); throw error; }
}
export async function auditShakers(db: ShakerSql, target: DatabaseTargetIdentity, confirmedFingerprint: string): Promise<ShakerBackup> {
  assertShakerTarget(target, confirmedFingerprint);
  return transaction(db, true, async () => planShakerConsolidation(await readShakerSnapshot(db, target)));
}
export async function writeShakerBackup(backup: ShakerBackup, backupRoot: string): Promise<string> {
  const root = await realpath(backupRoot);
  if (root !== await realpath(resolve(__dirname, "../../../..", "backup"))) throw new Error("Backup must be private backend/backup.");
  const path = resolve(root, `shaker-current-${randomUUID()}.json`);
  const handle = await open(path, "wx", 0o600);
  try { await handle.writeFile(JSON.stringify({ backup, sha256: shakerHash(backup) })); await handle.sync(); }
  finally { await handle.close(); }
  await loadShakerBackup(path, shakerHash(backup));
  return path;
}
export async function loadShakerBackup(path: string, expectedHash: string): Promise<ShakerBackup> {
  const root = await realpath(resolve(__dirname, "../../../..", "backup"));
  const actual = await realpath(path);
  if (dirname(actual) !== root) throw new Error("Unsafe backup path.");
  const parsed = JSON.parse(await readFile(actual, "utf8")) as { backup: ShakerBackup; sha256: string };
  if (parsed.sha256 !== expectedHash || shakerHash(parsed.backup) !== expectedHash || parsed.backup.version !== 1) {
    throw new Error("Backup read-back/hash mismatch.");
  }
  const planned = planShakerConsolidation(parsed.backup.before);
  if (!same(planned.after, parsed.backup.after) || !same(planned.additions, parsed.backup.additions)) throw new Error("Invalid backup plan.");
  return parsed.backup;
}
export async function executeShakerConsolidation(db: ShakerSql, target: DatabaseTargetIdentity,
  confirmedFingerprint: string, backupPath: string, backupHash: string): Promise<ShakerReceipt> {
  assertShakerTarget(target, confirmedFingerprint);
  const backup = await loadShakerBackup(backupPath, backupHash);
  if (!same(target, backup.before.target)) throw new Error("Backup target mismatch.");
  return transaction(db, false, async () => {
    const current = await readShakerSnapshot(db, target);
    if (same(current, backup.after)) return { added: 0, removed: 0, deleted: 0, noop: true, snapshotHash: shakerHash(current) };
    if (!same(current, backup.before)) throw new Error("Pre-merge drift.");
    let added = 0;
    for (const link of backup.additions) {
      added += (await db.query('INSERT INTO public."ProductCategory" ("productId","categoryId","createdAt") VALUES ($1,$2,$3)', [link["productId"], link["categoryId"], link["createdAt"]])).rowCount ?? 0;
    }
    const obsolete = category(backup.before, "shakers-y-botellas");
    const removed = (await db.query('DELETE FROM public."ProductCategory" WHERE "categoryId"=$1', [obsolete["id"]])).rowCount;
    const deleted = (await db.query('DELETE FROM public."Category" WHERE id=$1', [obsolete["id"]])).rowCount;
    const after = await readShakerSnapshot(db, target);
    if (added !== 4 || removed !== 23 || deleted !== 1 || !same(after, backup.after)) throw new Error("Merge receipt/invariant mismatch.");
    return { added, removed, deleted, noop: false, snapshotHash: shakerHash(after) };
  });
}
export async function recoverShakerConsolidation(db: ShakerSql, target: DatabaseTargetIdentity,
  confirmedFingerprint: string, backupPath: string, backupHash: string): Promise<void> {
  assertShakerTarget(target, confirmedFingerprint);
  const backup = await loadShakerBackup(backupPath, backupHash);
  if (!same(target, backup.before.target)) throw new Error("Backup target mismatch.");
  await transaction(db, false, async () => {
    const current = await readShakerSnapshot(db, target);
    const root = category(backup.before, "shakers");
    const obsolete = category(backup.before, "shakers-y-botellas");
    const scope = (snapshot: ShakerSnapshot) => ({ categories: snapshot.categories.filter((row) => [root["id"], obsolete["id"]].includes(row["id"]) || row["slug"] === "shakers-y-botellas"),
      links: snapshot.links.filter((row) => [root["id"], obsolete["id"]].includes(row["categoryId"])) });
    if (!same(current.references, backup.after.references)) throw new Error("Recovery reference drift.");
    if (same(scope(current), scope(backup.before))) return;
    if (!same(scope(current), scope(backup.after))) throw new Error("Conflicting subsequent category edits.");
    const keys = Object.keys(obsolete);
    if (keys.some((key) => !/^[A-Za-z][A-Za-z0-9]*$/.test(key))) throw new Error("Unsafe recovery columns.");
    await db.query(`INSERT INTO public."Category" (${keys.map((key) => `"${key}"`).join(",")}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(",")})`, keys.map((key) => obsolete[key]));
    for (const link of memberships(backup.before, obsolete["id"])) {
      await db.query('INSERT INTO public."ProductCategory" ("productId","categoryId","createdAt") VALUES ($1,$2,$3)', [link["productId"], link["categoryId"], link["createdAt"]]);
    }
    for (const link of backup.additions) {
      if ((await db.query('DELETE FROM public."ProductCategory" WHERE "productId"=$1 AND "categoryId"=$2', [link["productId"], link["categoryId"]])).rowCount !== 1) throw new Error("Recovery addition conflict.");
    }
    const restored = await readShakerSnapshot(db, target);
    if (!same(scope(restored), scope(backup.before)) || !same(restored.invariants, current.invariants) ||
      !same(restored.categories.filter((row) => ![root["id"], obsolete["id"]].includes(row["id"])), current.categories.filter((row) => row["id"] !== root["id"])) ||
      !same(restored.links.filter((row) => ![root["id"], obsolete["id"]].includes(row["categoryId"])), current.links.filter((row) => row["categoryId"] !== root["id"]))) throw new Error("Recovery invariant mismatch.");
  });
}

export function configuredShakerTarget(): DatabaseTargetIdentity { return identifyDatabaseTarget(); }
