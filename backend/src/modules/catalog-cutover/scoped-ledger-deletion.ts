import { Prisma } from "../../generated/prisma/client";
import { identifyDatabaseTarget } from "../catalog-scraper/operations/database-target";

interface LedgerProtection {
  definition: string;
  body: string;
  enabled: string;
  triggerType: number;
  unconditional: boolean;
}

/** Trusted local-owner maintenance. DDL and scope disappear on rollback; the original function is restored before commit. */
export async function withScopedLedgerDeletion<T>(
  transaction: Prisma.TransactionClient,
  approvedIds: readonly string[],
  operation: () => Promise<T>,
): Promise<T> {
  if (approvedIds.length === 0) return operation();
  const configured = identifyDatabaseTarget();
  if (configured.host !== "127.0.0.1" || configured.port !== 5432 || configured.schema !== "public") {
    throw new Error("Scoped ledger maintenance requires the confirmed loopback connection.");
  }
  const targets = await transaction.$queryRaw<Array<{ database: string; schema: string }>>(Prisma.sql`
    SELECT current_database()::text AS database, current_schema()::text AS schema
  `);
  const target = targets[0];
  if (!target || target.database !== configured.database || target.schema !== "public" || !["entrenar", "entrenar_catalog_cutover_scratch"].includes(target.database)) {
    throw new Error("Scoped ledger maintenance requires the confirmed local database.");
  }
  const protections = await transaction.$queryRaw<LedgerProtection[]>(Prisma.sql`
    SELECT pg_get_functiondef(p.oid)::text AS definition, p.prosrc::text AS body,
           t.tgenabled::text AS enabled, t.tgtype::int AS "triggerType", t.tgqual IS NULL AS unconditional
    FROM pg_trigger t
    JOIN pg_proc p ON p.oid = t.tgfoid
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE t.tgrelid = 'public."InventoryHistory"'::regclass
      AND t.tgname = 'InventoryHistory_append_only' AND NOT t.tgisinternal
      AND n.nspname = 'public' AND p.proname = 'prevent_inventory_history_mutation'
      AND p.pronargs = 0 AND p.prorettype = 'trigger'::regtype
  `);
  const original = protections[0];
  const expectedBody = "BEGIN RAISE EXCEPTION 'InventoryHistory is append-only'; END;";
  if (protections.length !== 1 || !original || original.enabled !== "O" || original.triggerType !== 27 || !original.unconditional || original.body.replace(/\s+/g, " ").trim() !== expectedBody) {
    throw new Error("Inventory append-only protection changed; maintenance refused.");
  }
  await transaction.$executeRaw(Prisma.sql`
    CREATE TEMP TABLE cutover_approved_ledger_rows (
      id text PRIMARY KEY, transaction_id bigint NOT NULL, backend_pid int NOT NULL, database_name text NOT NULL
    ) ON COMMIT DROP
  `);
  await transaction.$executeRaw(Prisma.sql`
    INSERT INTO pg_temp.cutover_approved_ledger_rows
    SELECT id, txid_current(), pg_backend_pid(), current_database()::text
    FROM unnest(ARRAY[${Prisma.join(approvedIds)}]::text[]) AS approved(id)
  `);
  await transaction.$executeRaw(Prisma.raw(`
    CREATE OR REPLACE FUNCTION public.prevent_inventory_history_mutation()
    RETURNS trigger LANGUAGE plpgsql AS $cutover$
    DECLARE permitted boolean;
    BEGIN
      IF TG_OP <> 'DELETE' OR TG_TABLE_SCHEMA <> 'public' OR TG_TABLE_NAME <> 'InventoryHistory'
         OR current_database() NOT IN ('entrenar', 'entrenar_catalog_cutover_scratch')
         OR to_regclass('pg_temp.cutover_approved_ledger_rows') IS NULL THEN
        RAISE EXCEPTION 'InventoryHistory is append-only';
      END IF;
      EXECUTE 'SELECT EXISTS (SELECT 1 FROM pg_temp.cutover_approved_ledger_rows
        WHERE id = $1 AND transaction_id = txid_current() AND backend_pid = pg_backend_pid()
          AND database_name = current_database())' INTO permitted USING OLD.id;
      IF NOT permitted THEN RAISE EXCEPTION 'InventoryHistory is append-only'; END IF;
      RETURN OLD;
    END;
    $cutover$;
  `));
  const result = await operation();
  await transaction.$executeRaw(Prisma.raw(original.definition));
  await transaction.$executeRaw(Prisma.sql`DROP TABLE pg_temp.cutover_approved_ledger_rows`);
  return result;
}
