import { mkdtemp, mkdir, rm, writeFile, chmod } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { identifyDatabaseTarget } from "../catalog-scraper/operations/database-target";
import { BackupRehearsal, assertIsolatedScratchTarget, validatePrivateArchivePath } from "./backup-rehearsal";
import type { CatalogSnapshot } from "./cutover-contracts";

describe("backup rehearsal safety", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "catalog-cutover-"));
    await mkdir(join(root, "backup"));
    await writeFile(join(root, "backup", "catalog.dump"), "safe archive");
    if (process.platform !== "win32") await chmod(join(root, "backup", "catalog.dump"), 0o600);
  });

  afterEach(async () => rm(root, { force: true, recursive: true }));

  it("rejects traversal and non-absolute archive paths", async () => {
    await expect(validatePrivateArchivePath(join(root, "backup"), "relative.dump")).rejects.toThrow("absolute");
    await expect(validatePrivateArchivePath(join(root, "backup"), join(root, "outside.dump"))).rejects.toThrow("inside");
  });

  it("refuses scratch aliases and non-scratch databases", () => {
    const target = identifyDatabaseTarget("postgresql://user:secret@127.0.0.1:5432/entrenar?schema=public");
    const alias = identifyDatabaseTarget("postgresql://user:secret@127.0.0.1:5432/entrenar?schema=public");
    const ordinary = identifyDatabaseTarget("postgresql://user:secret@127.0.0.1:5432/other?schema=public");

    expect(() => assertIsolatedScratchTarget(target, alias)).toThrow("distinct local scratch");
    expect(() => assertIsolatedScratchTarget(target, ordinary)).toThrow("distinct local scratch");
  });

  it("passes fixed executable arguments and requires complete restore/deletion coverage", async () => {
    const target = identifyDatabaseTarget("postgresql://user:secret@127.0.0.1:5432/entrenar?schema=public");
    const scratchUrl = "postgresql://user:secret@127.0.0.1:5432/entrenar_scratch?schema=public";
    const snapshot = scratchSnapshot(identifyDatabaseTarget(scratchUrl).fingerprint);
    const commands: string[][] = [];
    const environments: NodeJS.ProcessEnv[] = [];
    const rehearsal = new BackupRehearsal({
      backupRoot: join(root, "backup"),
      assertGitIgnored: async () => undefined,
      execute: async (executable, args, _timeout, environment) => { commands.push([executable, ...args]); environments.push(environment ?? {}); return { stdout: "", stderr: "" }; },
      readScratchSnapshot: async () => snapshot,
    });
    const result = await rehearsal.rehearse({
      archivePath: join(root, "backup", "catalog.dump"), target, scratchConnectionString: scratchUrl,
      expectedSnapshot: snapshot, deletionRefs: ["row-ref"],
    });

    expect(commands).toHaveLength(2);
    expect(commands[0]?.[0]).toBe("pg_restore");
    expect(commands[1]).toContain("--single-transaction");
    expect(commands.join(" ")).not.toContain("secret");
    expect(commands[1]?.join(" ")).not.toContain("user@");
    expect(environments[1]?.["PGPASSWORD"]).toBe("secret");
    expect(result.deletionCoverage).toBe(1);
    expect(result.path).toBe("backend/backup/<private-archive>");
  });

  it("keeps metacharacter-bearing archive names inside one argument and blocks inadequate coverage", async () => {
    const target = identifyDatabaseTarget("postgresql://user:secret@127.0.0.1:5432/entrenar?schema=public");
    const scratchUrl = "postgresql://user:secret@127.0.0.1:5432/entrenar_scratch?schema=public";
    const archivePath = join(root, "backup", "catalog;do-not-execute.dump");
    await writeFile(archivePath, "archive");
    if (process.platform !== "win32") await chmod(archivePath, 0o600);
    const argumentsSeen: string[][] = [];
    const rehearsal = new BackupRehearsal({
      backupRoot: join(root, "backup"),
      assertGitIgnored: async () => undefined,
      execute: async (_executable, args) => { argumentsSeen.push([...args]); return { stdout: "", stderr: "" }; },
      readScratchSnapshot: async () => ({ ...scratchSnapshot(identifyDatabaseTarget(scratchUrl).fingerprint), records: [] }),
    });

    await expect(rehearsal.rehearse({
      archivePath,
      target,
      scratchConnectionString: scratchUrl,
      expectedSnapshot: scratchSnapshot(identifyDatabaseTarget(scratchUrl).fingerprint),
      deletionRefs: ["missing-ref"],
    })).rejects.toThrow("Scratch restoration does not cover every approved deletion selector.");
    expect(argumentsSeen[0]).toContain(archivePath);
    expect(argumentsSeen[0]).not.toContain("do-not-execute.dump");
  });

  it("redacts timeout detail from restore failures", async () => {
    const target = identifyDatabaseTarget("postgresql://user:secret@127.0.0.1:5432/entrenar?schema=public");
    const scratchUrl = "postgresql://user:secret@127.0.0.1:5432/entrenar_scratch?schema=public";
    const rehearsal = new BackupRehearsal({
      backupRoot: join(root, "backup"),
      assertGitIgnored: async () => undefined,
      execute: async () => { throw new Error("password=secret timed out"); },
      readScratchSnapshot: async () => scratchSnapshot("unused"),
    });

    await expect(rehearsal.rehearse({
      archivePath: join(root, "backup", "catalog.dump"), target, scratchConnectionString: scratchUrl,
      expectedSnapshot: scratchSnapshot("unused"), deletionRefs: [],
    })).rejects.toThrow("Private backup validation or scratch restoration failed.");
  });

  it("redacts a distinct pg_restore nonzero exit failure", async () => {
    const target = identifyDatabaseTarget("postgresql://user:secret@127.0.0.1:5432/entrenar?schema=public");
    const scratchUrl = "postgresql://user:secret@127.0.0.1:5432/entrenar_scratch?schema=public";
    const nonzeroExit = Object.assign(new Error("pg_restore exited with code 1; password=secret"), { code: 1 });
    const rehearsal = new BackupRehearsal({
      backupRoot: join(root, "backup"),
      assertGitIgnored: async () => undefined,
      execute: async () => { throw nonzeroExit; },
      readScratchSnapshot: async () => scratchSnapshot("unused"),
    });

    await expect(rehearsal.rehearse({
      archivePath: join(root, "backup", "catalog.dump"),
      target,
      scratchConnectionString: scratchUrl,
      expectedSnapshot: scratchSnapshot("unused"),
      deletionRefs: [],
    })).rejects.toThrow("Private backup validation or scratch restoration failed.");
  });
});

function scratchSnapshot(targetFingerprint: string): CatalogSnapshot {
  return {
    snapshotId: "scratch-audit", targetFingerprint, schema: "public", populationDigest: "snapshot-digest",
    counts: { Product: 1 }, records: [{ model: "Product", ref: "row-ref", rowDigest: "digest", row: { id: "p1" } }],
    foreignKeys: [], blockers: [],
  };
}
