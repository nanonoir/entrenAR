import { Injectable } from "@nestjs/common";
import { createRequire } from "node:module";

const SHOWCASE_RESET_RUN_LOCK_KEY = 847_291_644;
const loadModule = createRequire(__filename);

interface PgQueryResult {
  rows: readonly { acquired?: boolean }[];
}

interface PgClient {
  connect(): Promise<void>;
  end(): Promise<void>;
  query(query: string, values?: readonly number[]): Promise<PgQueryResult>;
}

interface PgModule {
  Client: new (options: { connectionString: string }) => PgClient;
}

@Injectable()
export class ShowcaseResetRunMutex {
  async run<T>(callback: () => Promise<T>): Promise<{ acquired: boolean; value?: T }> {
    const connectionString = process.env["DATABASE_URL"];
    if (!connectionString) throw new Error("DATABASE_URL must be set before acquiring the showcase reset mutex.");

    const client = new (loadPgModule().Client)({ connectionString });
    await client.connect();
    try {
      const result = await client.query("SELECT pg_try_advisory_lock($1) AS acquired", [SHOWCASE_RESET_RUN_LOCK_KEY]);
      if (!result.rows[0]?.acquired) return { acquired: false };
      try {
        return { acquired: true, value: await callback() };
      } finally {
        await client.query("SELECT pg_advisory_unlock($1)", [SHOWCASE_RESET_RUN_LOCK_KEY]);
      }
    } finally {
      await client.end();
    }
  }
}

function loadPgModule(): PgModule {
  return loadModule("pg") as PgModule;
}
