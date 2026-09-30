import { identifyDatabaseTarget, reportDatabaseTarget } from "./database-target";

describe("database target identity", () => {
  it("ignores credentials and non-identity query parameters", () => {
    const first = identifyDatabaseTarget("postgresql://first:secret@LOCALHOST:5432/shop?schema=public&sslmode=require");
    const second = identifyDatabaseTarget("postgresql://second:different@localhost:5432/shop?schema=public&application_name=worker");

    expect(first.fingerprint).toBe(second.fingerprint);
    expect(JSON.stringify(reportDatabaseTarget(first))).not.toMatch(/first|secret|sslmode|require/i);
  });

  it("changes the fingerprint for host, database, port, or effective schema changes", () => {
    const base = identifyDatabaseTarget("postgres://user:pass@localhost:5432/shop");
    const changed = [
      "postgres://user:pass@db.internal:5432/shop",
      "postgres://user:pass@localhost:5433/shop",
      "postgres://user:pass@localhost:5432/other",
      "postgres://user:pass@localhost:5432/shop?schema=catalog",
      "postgres://user:pass@remote.internal:5432/shop",
      "postgres://user:pass@localhost:5434/shop",
      "postgres://user:pass@localhost:5432/another",
    ].map((connection) => identifyDatabaseTarget(connection).fingerprint);

    expect(new Set(changed).size).toBe(changed.length);
    expect(changed).not.toContain(base.fingerprint);
  });

  it("normalizes URL query aliases to their canonical URL components", () => {
    const aliases = [
      ["postgres://user:pass@db.internal:5432/shop", "postgres://user:pass@localhost:5432/shop?host=db.internal"],
      ["postgres://user:pass@localhost:5433/shop", "postgres://user:pass@localhost:5432/shop?port=5433"],
      ["postgres://user:pass@localhost:5432/other", "postgres://user:pass@localhost:5432/shop?dbname=other"],
    ];

    for (const [canonical, alias] of aliases) {
      expect(identifyDatabaseTarget(alias).fingerprint).toBe(identifyDatabaseTarget(canonical).fingerprint);
    }
  });

  it("rejects ambiguous and malformed targets without echoing the connection string", () => {
    for (const connection of ["postgres://user:secret@localhost:5432/shop?schema=a&schema=b", "not-a-url", "mysql://localhost/shop"]) {
      try {
        identifyDatabaseTarget(connection);
        throw new Error("Expected target validation to fail.");
      } catch (error) {
        expect((error as Error).message).not.toContain("secret");
        expect((error as Error).message).not.toContain(connection);
      }
    }
  });
});
