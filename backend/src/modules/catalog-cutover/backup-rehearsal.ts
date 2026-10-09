import { createHash } from "node:crypto";
import { execFile as nodeExecFile } from "node:child_process";
import { lstat, readFile, realpath } from "node:fs/promises";
import { promisify } from "node:util";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { identifyDatabaseTarget, type DatabaseTargetIdentity } from "../catalog-scraper/operations/database-target";
import type { BackupEvidence, CatalogSnapshot } from "./cutover-contracts";

const execFile = promisify(nodeExecFile);
export const PG_RESTORE_EXECUTABLE = "pg_restore";
export const BACKUP_REHEARSAL_TIMEOUT_MS = 120_000;

export interface BackupCommandResult {
  stdout: string;
  stderr: string;
}

export interface BackupRehearsalDependencies {
  backupRoot?: string;
  execute?: (executable: string, args: readonly string[], timeoutMs: number, environment?: NodeJS.ProcessEnv) => Promise<BackupCommandResult>;
  assertGitIgnored?: (archivePath: string) => Promise<void>;
  readScratchSnapshot: (connectionString: string) => Promise<CatalogSnapshot>;
}

export interface BackupRehearsalInput {
  archivePath: string;
  target: DatabaseTargetIdentity;
  scratchConnectionString: string;
  expectedSnapshot: CatalogSnapshot;
  deletionRefs: readonly string[];
}

export class BackupRehearsal {
  private readonly backupRoot: string;
  private readonly execute: NonNullable<BackupRehearsalDependencies["execute"]>;
  private readonly assertGitIgnored: NonNullable<BackupRehearsalDependencies["assertGitIgnored"]>;

  constructor(private readonly dependencies: BackupRehearsalDependencies) {
    const compiled = __dirname.includes(`${sep}dist${sep}`);
    this.backupRoot = resolve(dependencies.backupRoot ?? resolve(__dirname, compiled ? "../../../../backup" : "../../../backup"));
    this.execute = dependencies.execute ?? executeRestoreCommand;
    this.assertGitIgnored = dependencies.assertGitIgnored ?? assertArchiveGitIgnored;
  }

  async rehearse(input: BackupRehearsalInput): Promise<BackupEvidence> {
    const archivePath = await validatePrivateArchivePath(this.backupRoot, input.archivePath);
    await this.assertGitIgnored(archivePath);
    const archiveBytes = await readFile(archivePath);
    const stat = await lstat(archivePath);
    if (stat.size !== archiveBytes.byteLength || stat.size === 0 || (process.platform !== "win32" && (stat.mode & 0o077) !== 0)) {
      throw new Error("Private backup archive size or permissions are invalid.");
    }
    const sha256 = createHash("sha256").update(archiveBytes).digest("hex");
    await this.runRestore(["--list", archivePath]);

    const scratch = identifyDatabaseTarget(input.scratchConnectionString);
    assertIsolatedScratchTarget(input.target, scratch);
    const connection = restoreConnection(input.scratchConnectionString, scratch);
    await this.runRestore([
      "--clean", "--if-exists", "--single-transaction", "--no-owner", "--no-privileges",
      "--schema=public", `--dbname=${connection.safeDsn}`, archivePath,
    ], connection.environment);
    const restored = await this.dependencies.readScratchSnapshot(input.scratchConnectionString);
    if (restored.targetFingerprint !== scratch.fingerprint || restored.schema !== "public") {
      throw new Error("Scratch restoration reported an unexpected destination.");
    }
    if (restored.populationDigest !== input.expectedSnapshot.populationDigest || !sameCounts(restored.counts, input.expectedSnapshot.counts)) {
      throw new Error("Scratch restoration does not match the complete audited snapshot.");
    }
    const restoredRefs = new Set(restored.records.map(({ ref }) => ref));
    const deletionCoverage = input.deletionRefs.length === 0
      ? 1
      : input.deletionRefs.filter((ref) => restoredRefs.has(ref)).length / input.deletionRefs.length;
    if (deletionCoverage !== 1) throw new Error("Scratch restoration does not cover every approved deletion selector.");

    return {
      path: "backend/backup/<private-archive>", size: stat.size, sha256,
      scratchFingerprint: scratch.fingerprint, restoredPopulationDigest: restored.populationDigest, deletionCoverage,
    };
  }

  private async runRestore(args: readonly string[], environment?: NodeJS.ProcessEnv): Promise<void> {
    try {
      await this.execute(PG_RESTORE_EXECUTABLE, args, BACKUP_REHEARSAL_TIMEOUT_MS, environment);
    } catch {
      throw new Error("Private backup validation or scratch restoration failed.");
    }
  }
}

export async function validatePrivateArchivePath(backupRoot: string, archivePath: string): Promise<string> {
  if (!isAbsolute(archivePath)) throw new Error("Backup archive path must be absolute.");
  const root = await realpath(backupRoot);
  const archive = resolve(archivePath);
  const rootRelative = relative(root, archive);
  if (!rootRelative || rootRelative.startsWith("..") || isAbsolute(rootRelative)) throw new Error("Backup archive must be inside backend/backup/.");
  const details = await lstat(archive);
  if (!details.isFile() || details.isSymbolicLink()) throw new Error("Backup archive must be a regular private file.");
  const actual = await realpath(archive);
  if (actual !== archive) throw new Error("Backup archive path must not resolve through an alias.");
  return actual;
}

export function assertIsolatedScratchTarget(target: DatabaseTargetIdentity, scratch: DatabaseTargetIdentity): void {
  const disposableName = /(?:^|[_-])(scratch|disposable|test)(?:[_-]|$)/i.test(scratch.database);
  if (scratch.fingerprint === target.fingerprint || scratch.host !== target.host || scratch.hostAddress !== target.hostAddress || scratch.port !== target.port ||
    scratch.schema !== "public" || scratch.database === target.database || !disposableName) {
    throw new Error("Restore destination must be a distinct local scratch database.");
  }
}

async function executeRestoreCommand(executable: string, args: readonly string[], timeoutMs: number, environment?: NodeJS.ProcessEnv): Promise<BackupCommandResult> {
  if (executable !== PG_RESTORE_EXECUTABLE) throw new Error("Unexpected restore executable.");
  try {
    const result = await execFile(executable, [...args], {
      timeout: timeoutMs,
      shell: false,
      windowsHide: true,
      maxBuffer: 2 * 1024 * 1024,
      env: { ...process.env, ...environment },
    });
    return { stdout: result.stdout, stderr: result.stderr };
  } catch {
    throw new Error("pg_restore did not complete successfully.");
  }
}

async function assertArchiveGitIgnored(archivePath: string): Promise<void> {
  try {
    const root = await execFile("git", ["rev-parse", "--show-toplevel"], { shell: false, windowsHide: true });
    const repositoryRoot = root.stdout.trim();
    const pathFromRoot = relative(repositoryRoot, archivePath);
    if (!pathFromRoot || pathFromRoot.startsWith("..") || isAbsolute(pathFromRoot)) throw new Error("Backup path is outside the repository.");
    await execFile("git", ["check-ignore", "--quiet", "--", pathFromRoot], { cwd: repositoryRoot, shell: false, windowsHide: true });
  } catch {
    throw new Error("Private backup archive must be Git-excluded before it can be used.");
  }
}

function restoreConnection(connectionString: string, target: DatabaseTargetIdentity): { safeDsn: string; environment: NodeJS.ProcessEnv } {
  const url = new URL(connectionString);
  const environment: NodeJS.ProcessEnv = {};
  const username = url.username ? decodeURIComponent(url.username) : url.searchParams.get("user");
  const password = url.password ? decodeURIComponent(url.password) : url.searchParams.get("password");
  if (username) environment["PGUSER"] = username;
  if (password) environment["PGPASSWORD"] = password;
  const host = target.host.includes(":") ? `[${target.host}]` : target.host;
  const database = encodeURIComponent(target.database);
  return { safeDsn: `postgresql://${host}:${target.port}/${database}?schema=${encodeURIComponent(target.schema)}`, environment };
}

function sameCounts(left: Readonly<Record<string, number>>, right: Readonly<Record<string, number>>): boolean {
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return JSON.stringify(leftKeys) === JSON.stringify(rightKeys) && leftKeys.every((key) => left[key] === right[key]);
}
