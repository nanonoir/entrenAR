import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { RUN_STATUS, RunStore } from "../catalog-scraper/run/run-store";

export interface ImportApproval { runId: string; manifestSha256: string; runRoot: string; environment: string }
export interface ImportTargetPort { environmentFingerprint(): Promise<string>; productCount(): Promise<number> }
export interface ImportAssetReadinessPort { destinationFingerprint(): string; verify(expected: readonly ImportAssetRecord[]): Promise<void> }
export interface ImportAssetRecord { key: string; size: number; sha256: string }

export function parseImportApproval(args: readonly string[]): { filePath: string; approval: ImportApproval } {
  const values = new Map<string, string>();
  let filePath = "";
  for (const arg of args) {
    if (!arg.startsWith("--")) {
      if (filePath) throw new Error("Duplicate manifest path.");
      filePath = arg;
      continue;
    }
    const match = /^--([^=]+)=(.*)$/.exec(arg);
    if (!match || values.has(match[1]!)) throw new Error("Unknown or duplicate import flag.");
    values.set(match[1]!, match[2]!);
  }
  if (!filePath) throw new Error("A manifest path is required.");
  const expected = ["run-id", "manifest-sha256", "run-root", "confirm-db-fingerprint"];
  const keys = [...values.keys()];
  if (keys.some((key) => !expected.includes(key)) || keys.length !== expected.length || expected.some((key) => !values.get(key))) {
    throw new Error("Run-bound import approval is incomplete.");
  }
  return {
    filePath,
    approval: {
      runId: values.get("run-id")!,
      manifestSha256: values.get("manifest-sha256")!,
      runRoot: values.get("run-root")!,
      environment: values.get("confirm-db-fingerprint")!,
    },
  };
}

export async function assertManifestApproval(filePath: string, approval: ImportApproval, target: ImportTargetPort, assets: ImportAssetReadinessPort): Promise<void> {
  const run = await assertOwnedManifest(filePath, approval);
  if (run.status !== RUN_STATUS.READY || run.manifestSha256 !== approval.manifestSha256) {
    throw new Error("Approved run is not READY or its digest changed.");
  }
  if (!run.targetFingerprint || run.targetFingerprint !== approval.environment || await target.environmentFingerprint() !== approval.environment) {
    throw new Error("Database target does not match approval.");
  }
  if (await target.productCount() !== 0) throw new Error("Catalog import target is not empty.");
  if (!run.r2DestinationFingerprint || assets.destinationFingerprint() !== run.r2DestinationFingerprint) throw new Error("R2 destination does not match the READY run.");
  const store = new RunStore(await realpath(resolve(approval.runRoot)));
  const inventoryPath = store.path(approval.runId, "inventory.json");
  const inventoryBytes = await readFile(inventoryPath);
  if (!run.fileDigests?.["inventory.json"] || createHash("sha256").update(inventoryBytes).digest("hex") !== run.fileDigests["inventory.json"]) {
    throw new Error("Frozen inventory digest does not match the READY run.");
  }
  const inventory = JSON.parse(inventoryBytes.toString("utf8")) as ImportAssetRecord[];
  const expected = [...run.expectedObjects].sort((left, right) => left.key.localeCompare(right.key));
  const actual = [...inventory].sort((left, right) => left.key.localeCompare(right.key));
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error("Frozen inventory does not match READY evidence.");
  await assets.verify(expected);
}

export async function assertManifestReconciliation(filePath: string, approval: ImportApproval, target: ImportTargetPort): Promise<void> {
  const run = await assertOwnedManifest(filePath, approval);
  if (run.status !== RUN_STATUS.RECONCILIATION_REQUIRED || run.manifestSha256 !== approval.manifestSha256) {
    throw new Error("Run is not awaiting reconciliation or its digest changed.");
  }
  if (!run.targetFingerprint || run.targetFingerprint !== approval.environment || await target.environmentFingerprint() !== approval.environment) {
    throw new Error("Database target does not match approval.");
  }
}

async function assertOwnedManifest(filePath: string, approval: ImportApproval) {
  const runRoot = await realpath(resolve(approval.runRoot));
  const expectedRunDirectory = resolve(runRoot, approval.runId);
  const runDirectory = await realpath(expectedRunDirectory);
  const manifestPath = await realpath(resolve(filePath));
  if (runDirectory !== expectedRunDirectory || relative(runRoot, runDirectory).startsWith("..") || relative(runDirectory, manifestPath) !== "products.json") {
    throw new Error("Manifest is not owned by the approved run.");
  }
  const run = await new RunStore(runRoot).load(approval.runId);
  const bytes = await readFile(manifestPath);
  const actual = createHash("sha256").update(bytes).digest("hex");
  if (actual !== approval.manifestSha256 || run.fileDigests?.["products.json"] !== actual) throw new Error("Manifest digest does not match approval.");
  return run;
}
