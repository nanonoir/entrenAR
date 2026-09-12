import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("auth session migration", () => {
  it("backfills existing refresh rows as CUSTOMER before removing the default", () => {
    const migration = readFileSync(
      join(process.cwd(), "prisma", "migrations", "20260911000000_auth_session_context", "migration.sql"),
      "utf8",
    );

    expect(migration).toContain("ADD COLUMN \"sessionType\" \"RefreshSessionType\" NOT NULL DEFAULT 'CUSTOMER'");
    expect(migration).toContain("ALTER TABLE \"RefreshToken\" ALTER COLUMN \"sessionType\" DROP DEFAULT");
    expect(migration).toContain("CREATE TYPE \"RefreshSessionType\" AS ENUM ('CUSTOMER', 'ADMIN')");
  });
});
