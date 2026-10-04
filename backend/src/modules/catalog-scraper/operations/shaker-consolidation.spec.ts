import { resolve } from "node:path";
import { identifyDatabaseTarget } from "./database-target";
import { assertShakerTarget, auditShakers, executeShakerConsolidation, loadShakerBackup,
  planShakerConsolidation, recoverShakerConsolidation, shakerHash, writeShakerBackup,
  type ShakerSnapshot, type ShakerSql } from "./shaker-consolidation";

const files = new Map<string, string>();
jest.mock("node:fs/promises", () => ({
  realpath: async (path: string) => path,
  readFile: async (path: string) => { if (!files.has(path)) throw new Error("Missing backup"); return files.get(path); },
  open: async (path: string) => {
    if (files.has(path)) throw new Error("Exists");
    return { writeFile: async (value: string) => { files.set(path, value); }, sync: async () => undefined, close: async () => undefined };
  },
}));
const target = identifyDatabaseTarget("postgresql://user:password@127.0.0.1:5432/entrenar?schema=public");
const root = resolve(__dirname, "../../../..", "backup");
function fixture(): ShakerSnapshot {
  return { target, categories: [{ id: "root", slug: "shakers", parentId: null }, { id: "old", slug: "shakers-y-botellas", parentId: "training" }],
    links: [...Array.from({ length: 19 }, (_, i) => ({ productId: `p${i}`, categoryId: "root" })),
      ...Array.from({ length: 23 }, (_, i) => ({ productId: `p${i}`, categoryId: "old" })), { productId: "p22", categoryId: "protein" }]
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
    counts: { Product: 649, ProductVariant: 1119, ProductImage: 3790, Category: 61, ProductCategory: 2124 },
    invariants: { Product: "protected" }, references: [] };
}
function mockDb(snapshot: ShakerSnapshot): ShakerSql & { commands: string[] } {
  const commands: string[] = [];
  return { commands, query: async (sql) => {
    commands.push(sql);
    if (sql.includes("current_database")) return { rows: [{ database: "entrenar", schema: "public", address: "127.0.0.1", port: 5432 }], rowCount: 1 };
    if (sql.includes("pg_constraint")) return { rows: ["Category:parentId", "ProductCategory:categoryId", "CouponCategory:categoryId", "ShippingDiscountCategory:categoryId"].map((key) => {
      const [table, column] = key.split(":"); return { schema: "public", table, column, target_column: "id", width: 1 };
    }), rowCount: 4 };
    if (sql.includes("pg_tables")) return { rows: [{ tablename: "Category" }, { tablename: "ProductCategory" }], rowCount: 2 };
    if (sql.includes("to_jsonb")) return { rows: (sql.includes('"ProductCategory"') ? snapshot.links : snapshot.categories).map((row) => ({ row })), rowCount: 0 };
    return { rows: [], rowCount: 0 };
  } };
}
describe("bounded shaker operation (no database connection)", () => {
  beforeEach(() => files.clear());
  it("plans only the four missing root links, retaining combo membership and original rows", () => {
    const before = fixture(); const backup = planShakerConsolidation(before);
    expect(backup.additions).toHaveLength(4);
    expect(backup.after.links.filter((row) => row["categoryId"] === "root")).toHaveLength(23);
    expect(backup.after.links).toContainEqual({ productId: "p22", categoryId: "protein" });
    expect(backup.before).toEqual(before);
    expect(backup.after.counts).toMatchObject({ Category: 60, ProductCategory: 2105 });
  });
  it.each(["missing", "count", "duplicate", "child"])("stops %s drift", (kind) => {
    const before = fixture();
    if (kind === "missing") before.categories.pop();
    if (kind === "count") before.counts["Product"] = 648;
    if (kind === "duplicate") before.links.push(before.links[0]!);
    if (kind === "child") before.categories.push({ id: "child", parentId: "old" });
    expect(() => planShakerConsolidation(before)).toThrow();
  });
  it("rejects nonlocal or unconfirmed targets", () => {
    expect(() => assertShakerTarget(target, "wrong")).toThrow();
    expect(() => assertShakerTarget({ ...target, host: "remote" }, target.fingerprint)).toThrow();
  });
  it("read-back validates immutable backup and detects tampering", async () => {
    const backup = planShakerConsolidation(fixture());
    const path = await writeShakerBackup(backup, root);
    expect(await loadShakerBackup(path, shakerHash(backup))).toEqual(backup);
    files.set(path, JSON.stringify({ backup, sha256: "wrong" }));
    await expect(loadShakerBackup(path, shakerHash(backup))).rejects.toThrow("mismatch");
  });
  it("requires evidence before any transaction or mutation", async () => {
    const db = mockDb(fixture());
    await expect(executeShakerConsolidation(db, target, target.fingerprint, resolve(root, "missing.json"), "x")).rejects.toThrow();
    expect(db.commands).toEqual([]);
  });
  it("rolls back audit baseline drift without issuing mutations", async () => {
    const db = mockDb(fixture());
    await expect(auditShakers(db, target, target.fingerprint)).rejects.toThrow("Baseline drift");
    expect(db.commands).toContain("ROLLBACK");
    expect(db.commands.some((sql) => /^(INSERT|DELETE)/.test(sql))).toBe(false);
  });
  it("stops unknown foreign keys", async () => {
    const db = mockDb(fixture()); const query = db.query;
    db.query = async (sql, values) => sql.includes("pg_constraint") ? { rows: [], rowCount: 0 } : query(sql, values);
    await expect(auditShakers(db, target, target.fingerprint)).rejects.toThrow("Unknown category references");
  });
  it("rejects recovery conflicts and rolls back", async () => {
    const backup = planShakerConsolidation(fixture()); const path = await writeShakerBackup(backup, root);
    const db = mockDb(fixture());
    await expect(recoverShakerConsolidation(db, target, target.fingerprint, path, shakerHash(backup))).rejects.toThrow("reference drift");
    expect(db.commands).toContain("ROLLBACK");
  });
  it("commits exact receipts, reruns as no-op and recovers only evidenced links", async () => {
    const initial = fixture();
    const tables: Record<string, Record<string, unknown>[]> = {
      Category: [...initial.categories, ...Array.from({ length: 59 }, (_, i) => ({ id: `c${i}`, slug: `category-${i}`, parentId: null }))],
      ProductCategory: [...initial.links, ...Array.from({ length: 2081 }, (_, i) => ({ productId: `other${i}`, categoryId: "protein" }))],
      Product: Array.from({ length: 649 }, (_, i) => ({ id: `p${i}`, price: 100 })),
      ProductVariant: Array.from({ length: 1119 }, (_, i) => ({ id: `v${i}`, quantity: 10 })),
      ProductImage: Array.from({ length: 3790 }, (_, i) => ({ id: `i${i}` })),
    };
    const db = mockDb(initial); const query = db.query;
    db.query = async (sql, values = []) => {
      if (sql.includes("pg_tables")) return { rows: Object.keys(tables).sort().map((tablename) => ({ tablename })), rowCount: 5 };
      if (sql.includes("to_jsonb")) {
        const table = sql.match(/FROM public\."([^"]+)"/)?.[1];
        return { rows: (tables[table ?? ""] ?? []).map((row) => ({ row })), rowCount: 0 };
      }
      if (sql.startsWith('INSERT INTO public."ProductCategory"')) {
        tables["ProductCategory"]!.push({ productId: values[0], categoryId: values[1], ...(values[2] ? { createdAt: values[2] } : {}) });
        return { rows: [], rowCount: 1 };
      }
      if (sql.startsWith('DELETE FROM public."ProductCategory"')) {
        const before = tables["ProductCategory"]!;
        tables["ProductCategory"] = before.filter((row) => sql.includes('"productId"=$1') ? !(row["productId"] === values[0] && row["categoryId"] === values[1]) : row["categoryId"] !== values[0]);
        return { rows: [], rowCount: before.length - tables["ProductCategory"]!.length };
      }
      if (sql.startsWith('DELETE FROM public."Category"')) {
        tables["Category"] = tables["Category"]!.filter((row) => row["id"] !== values[0]);
        return { rows: [], rowCount: 1 };
      }
      if (sql.startsWith('INSERT INTO public."Category"')) {
        tables["Category"]!.push(Object.fromEntries(["id", "slug", "parentId"].map((key, i) => [key, values[i]])));
        return { rows: [], rowCount: 1 };
      }
      return query(sql, values);
    };
    const backup = await auditShakers(db, target, target.fingerprint);
    const path = await writeShakerBackup(backup, root); const hash = shakerHash(backup);
    const workingQuery = db.query;
    db.query = async (sql, values) => {
      if (sql.startsWith("INSERT")) throw new Error("Injected write failure");
      return workingQuery(sql, values);
    };
    await expect(executeShakerConsolidation(db, target, target.fingerprint, path, hash)).rejects.toThrow("Injected write failure");
    expect(db.commands).toContain("ROLLBACK");
    db.query = workingQuery;
    expect(await executeShakerConsolidation(db, target, target.fingerprint, path, hash)).toMatchObject({ added: 4, removed: 23, deleted: 1, noop: false });
    expect(await executeShakerConsolidation(db, target, target.fingerprint, path, hash)).toMatchObject({ added: 0, removed: 0, deleted: 0, noop: true });
    const rootRow = tables["Category"]!.find((row) => row["id"] === "root")!;
    rootRow["name"] = "subsequent edit";
    await expect(recoverShakerConsolidation(db, target, target.fingerprint, path, hash)).rejects.toThrow("Conflicting subsequent category edits");
    delete rootRow["name"];
    tables["Product"]![0]!["price"] = 200;
    await recoverShakerConsolidation(db, target, target.fingerprint, path, hash);
    expect(tables["Product"]![0]!["price"]).toBe(200);
    expect(tables["Category"]).toHaveLength(61);
    expect(tables["ProductCategory"]).toHaveLength(2124);
  });
});
