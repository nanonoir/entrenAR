import { createHash, randomUUID } from "node:crypto";
import { link, mkdir, readFile, rename, unlink, writeFile, lstat, open as openFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { z } from "zod";

export const RUN_STATUS = {
  CREATED: "CREATED", EXTRACTING: "EXTRACTING", SNAPSHOT_FROZEN: "SNAPSHOT_FROZEN",
  ASSETS_VALIDATED: "ASSETS_VALIDATED", R2_RESET: "R2_RESET", ASSETS_UPLOADED: "ASSETS_UPLOADED",
  CATEGORIES_SYNCED: "CATEGORIES_SYNCED", READY: "READY", IMPORTING: "IMPORTING",
  IMPORTED: "IMPORTED", RECONCILIATION_REQUIRED: "RECONCILIATION_REQUIRED", FAILED: "FAILED",
} as const;
export type RunStatus = (typeof RUN_STATUS)[keyof typeof RUN_STATUS];

const inventoryItemSchema = z.object({ key: z.string().regex(/^products\/[a-z0-9-]+\/\d+\.webp$/), sha256: z.string().length(64), size: z.number().int().nonnegative() }).strict();
export const runRecordSchema = z.object({
  runId: z.string().min(1), status: z.enum(Object.values(RUN_STATUS) as [RunStatus, ...RunStatus[]]),
  createdAt: z.string(), updatedAt: z.string(), extractionWindow: z.object({ startedAt: z.string(), endedAt: z.string().optional() }).optional(),
  targetFingerprint: z.string().optional(), r2DestinationFingerprint: z.string().optional(), buildFingerprint: z.string().optional(), sourceSha256: z.string().length(64).optional(), taxonomySha256: z.string().length(64).optional(), manifestSha256: z.string().length(64).optional(),
  fileDigests: z.record(z.string(), z.string().regex(/^[a-f0-9]{64}$/)).optional(),
  expectedObjects: z.array(inventoryItemSchema).default([]), counts: z.record(z.string(), z.number().int().nonnegative()).default({}), blockers: z.array(z.string()).default([]), stages: z.record(z.string(), z.string()).default({}), results: z.record(z.string(), z.unknown()).default({}),
}).strict();
export type RunRecord = z.infer<typeof runRecordSchema>;

export interface ImportReceiptCounts { products: number; variants: number; images: number; categoryLinks: number }

const transitions: Record<RunStatus, readonly RunStatus[]> = {
  CREATED: ["EXTRACTING", "FAILED"], EXTRACTING: ["SNAPSHOT_FROZEN", "FAILED"], SNAPSHOT_FROZEN: ["ASSETS_VALIDATED", "FAILED"],
  ASSETS_VALIDATED: ["R2_RESET", "FAILED"], R2_RESET: ["ASSETS_UPLOADED", "FAILED"], ASSETS_UPLOADED: ["CATEGORIES_SYNCED", "FAILED"],
  CATEGORIES_SYNCED: ["READY", "FAILED"], READY: ["IMPORTING", "FAILED"], IMPORTING: ["IMPORTED", "RECONCILIATION_REQUIRED", "FAILED"], IMPORTED: [], RECONCILIATION_REQUIRED: [], FAILED: [],
};

export function digest(value: Uint8Array | string): string { return createHash("sha256").update(value).digest("hex"); }
export function createRunId(now = new Date()): string { return `run-${now.toISOString().replace(/[-:.TZ]/g, "")}-${randomUUID().slice(0, 8)}`; }

export class RunStore {
  constructor(private readonly root = resolve(process.cwd(), "scrape-output")) {}
  path(runId: string, file = "run.json"): string {
    if (!/^[a-zA-Z0-9-]+$/.test(runId) || file.includes("..") || isAbsolute(file)) throw new Error("Unsafe run path.");
    const target = resolve(join(this.root, runId, file));
    if (relative(this.root, target).startsWith("..")) throw new Error("Unsafe run path.");
    return target;
  }
  async allocate(runId = createRunId()): Promise<RunRecord> {
    const now = new Date().toISOString();
    const record: RunRecord = { runId, status: RUN_STATUS.CREATED, createdAt: now, updatedAt: now, expectedObjects: [], counts: {}, blockers: [], stages: {}, results: {} };
    await mkdir(this.root, { recursive: true });
    await mkdir(this.path(runId, ""));
    await this.save(record);
    return record;
  }
  async load(runId: string): Promise<RunRecord> { return runRecordSchema.parse(JSON.parse(await readFile(this.path(runId), "utf8"))); }
  async save(record: RunRecord): Promise<void> {
    const checked = runRecordSchema.parse({ ...record, updatedAt: new Date().toISOString() });
    const target = this.path(checked.runId); const temporary = `${target}.${randomUUID()}.tmp`;
    await mkdir(dirname(target), { recursive: true }); await writeFile(temporary, `${JSON.stringify(checked, null, 2)}\n`, { encoding: "utf8", mode: 0o600 }); await rename(temporary, target);
  }
  async transition(runId: string, status: RunStatus, patch: Partial<RunRecord> = {}): Promise<RunRecord> {
    const current = await this.load(runId); if (!transitions[current.status].includes(status)) throw new Error(`Invalid run transition: ${current.status} -> ${status}`);
    const next = { ...current, ...patch, status }; await this.save(next); return runRecordSchema.parse(next);
  }
  async recordStage(runId: string, stage: string, result: "ok" | "failed", patch: Partial<RunRecord> = {}): Promise<RunRecord> {
    const current = await this.load(runId);
    const stages = { ...current.stages, [stage]: result };
    const blockers = result === "ok" ? current.blockers.filter((item) => item !== stage) : [...new Set([...current.blockers, stage])];
    return this.saveAndLoad({ ...current, ...patch, stages, blockers });
  }
  async evaluateReady(runId: string): Promise<boolean> {
    const current = await this.load(runId);
    const required = ["snapshotFreeze", "taxonomy", "localAssets", "r2Reset", "r2Upload", "exactSet", "categories", "manifest", "preflight"];
    return required.every((stage) => current.stages[stage] === "ok");
  }
  async claimTarget(runId: string, fingerprint: string): Promise<RunRecord> {
    if (!/^[a-f0-9]{64}$/.test(fingerprint)) throw new Error("Database target fingerprint is invalid.");
    const lockPath = this.path(runId, ".target-claim.lock");
    let lock: Awaited<ReturnType<typeof openFile>>;
    try {
      lock = await openFile(lockPath, "wx", 0o600);
    } catch {
      throw new Error("Database target claim is already in progress.");
    }
    try {
      const current = await this.load(runId);
      if (current.targetFingerprint && current.targetFingerprint !== fingerprint) throw new Error("Run is already bound to a different database target.");
      if (new Set<string>([RUN_STATUS.READY, RUN_STATUS.IMPORTING, RUN_STATUS.IMPORTED, RUN_STATUS.RECONCILIATION_REQUIRED, RUN_STATUS.FAILED]).has(current.status)) {
        throw new Error("Database target cannot be claimed at this run stage.");
      }
      if (current.targetFingerprint === fingerprint) return current;
      return this.saveAndLoad({ ...current, targetFingerprint: fingerprint });
    } finally {
      await lock.close();
      await unlink(lockPath).catch(() => undefined);
    }
  }
  async recordVerifiedStorage(runId: string, inventoryCount: number, r2DestinationFingerprint: string): Promise<RunRecord> {
    if (!/^[a-f0-9]{64}$/.test(r2DestinationFingerprint)) throw new Error("R2 destination fingerprint is invalid.");
    const current = await this.load(runId);
    if (!new Set<string>([RUN_STATUS.ASSETS_VALIDATED, RUN_STATUS.R2_RESET, RUN_STATUS.ASSETS_UPLOADED, RUN_STATUS.CATEGORIES_SYNCED]).has(current.status)) {
      throw new Error("Storage reconciliation requires a frozen, non-ready run.");
    }
    for (const stage of ["snapshotFreeze", "taxonomy", "localAssets", "exactSet", "manifest"]) {
      if (current.stages[stage] !== "ok") throw new Error(`Cannot attest storage without stage ${stage}.`);
    }
    if (current.r2DestinationFingerprint && current.r2DestinationFingerprint !== r2DestinationFingerprint) throw new Error("Run is bound to a different R2 destination.");
    return this.saveAndLoad({
      ...current,
      status: current.status === RUN_STATUS.CATEGORIES_SYNCED ? RUN_STATUS.CATEGORIES_SYNCED : RUN_STATUS.ASSETS_UPLOADED,
      r2DestinationFingerprint,
      stages: { ...current.stages, r2Reset: "ok", r2Upload: "ok" },
      counts: { ...current.counts, verifiedR2Objects: inventoryCount },
      blockers: current.blockers.filter((blocker) => blocker !== "HANDOFF_REQUIRED" && blocker !== "R2_RECONCILIATION_REQUIRED"),
      results: { ...current.results, storageReconciliation: { verified: true, inventoryCount, inventorySha256: current.fileDigests?.["inventory.json"], r2DestinationFingerprint, verifiedAt: new Date().toISOString() } },
    });
  }
  async recordStorageVerificationFailure(runId: string): Promise<RunRecord> {
    const current = await this.load(runId);
    if (!new Set<string>([RUN_STATUS.ASSETS_VALIDATED, RUN_STATUS.R2_RESET, RUN_STATUS.ASSETS_UPLOADED, RUN_STATUS.CATEGORIES_SYNCED, RUN_STATUS.READY]).has(current.status)) {
      throw new Error("Storage verification failure cannot change this run stage.");
    }
    const nextStatus = current.status === RUN_STATUS.CATEGORIES_SYNCED || current.status === RUN_STATUS.READY ? RUN_STATUS.CATEGORIES_SYNCED : RUN_STATUS.ASSETS_VALIDATED;
    return this.saveAndLoad({
      ...current,
      status: nextStatus,
      stages: { ...current.stages, r2Upload: "failed", exactSet: "failed", preflight: "failed" },
      blockers: [...new Set([...current.blockers, "R2_RECONCILIATION_FAILED"])],
      results: { ...current.results, storageReconciliation: { verified: false, failedAt: new Date().toISOString() } },
    });
  }
  async recordR2Reset(runId: string, r2DestinationFingerprint: string): Promise<RunRecord> {
    const current = await this.load(runId);
    if (current.status !== RUN_STATUS.ASSETS_VALIDATED && current.status !== RUN_STATUS.R2_RESET) throw new Error("R2 reset receipt requires validated assets.");
    if (!/^[a-f0-9]{64}$/.test(r2DestinationFingerprint) || (current.r2DestinationFingerprint && current.r2DestinationFingerprint !== r2DestinationFingerprint)) throw new Error("R2 destination does not match the run.");
    return this.saveAndLoad({ ...current, status: RUN_STATUS.R2_RESET, r2DestinationFingerprint, stages: { ...current.stages, r2Reset: "ok" } });
  }
  async recordR2Upload(runId: string, r2DestinationFingerprint: string, inventoryCount: number): Promise<RunRecord> {
    const current = await this.load(runId);
    if (current.status !== RUN_STATUS.R2_RESET && current.status !== RUN_STATUS.ASSETS_UPLOADED) throw new Error("R2 upload receipt requires a verified reset stage.");
    if (current.stages.r2Reset !== "ok" || current.r2DestinationFingerprint !== r2DestinationFingerprint) throw new Error("R2 upload target or reset evidence does not match the run.");
    return this.saveAndLoad({ ...current, status: RUN_STATUS.ASSETS_UPLOADED, stages: { ...current.stages, r2Upload: "ok", exactSet: "ok" }, counts: { ...current.counts, verifiedR2Objects: inventoryCount } });
  }
  async recordCategorySync(runId: string, targetFingerprint: string, counts: { created: number; updated: number; unchanged: number; conflicts: number }): Promise<RunRecord> {
    const current = await this.load(runId);
    if (!new Set<string>([RUN_STATUS.ASSETS_UPLOADED, RUN_STATUS.CATEGORIES_SYNCED]).has(current.status)) throw new Error("Category synchronization requires verified uploaded assets.");
    if (current.targetFingerprint && current.targetFingerprint !== targetFingerprint) throw new Error("Run is already bound to a different database target.");
    if (current.targetFingerprint !== targetFingerprint) throw new Error("Database target must be claimed before category synchronization.");
    if (counts.conflicts !== 0) throw new Error("Category synchronization conflicts prevent a successful handoff.");
    return this.saveAndLoad({
      ...current,
      status: RUN_STATUS.CATEGORIES_SYNCED,
      stages: { ...current.stages, categories: "ok" },
      blockers: current.blockers.filter((blocker) => blocker !== "HANDOFF_REQUIRED" && blocker !== "categories"),
      results: { ...current.results, categorySync: counts },
    });
  }
  async recordCategorySyncFailure(runId: string): Promise<RunRecord> {
    const current = await this.load(runId);
    if (!new Set<string>([RUN_STATUS.ASSETS_UPLOADED, RUN_STATUS.CATEGORIES_SYNCED]).has(current.status)) throw new Error("Category sync failure cannot change this run stage.");
    return this.saveAndLoad({ ...current, status: RUN_STATUS.ASSETS_UPLOADED, stages: { ...current.stages, categories: "failed", preflight: "failed" }, blockers: [...new Set([...current.blockers, "CATEGORY_SYNC_FAILED"])] });
  }
  async recordPreflight(runId: string, result: { ok: boolean; targetFingerprint: string; blockers: readonly string[]; expectedCount: number }): Promise<RunRecord> {
    const current = await this.load(runId);
    if (!new Set<string>([RUN_STATUS.CATEGORIES_SYNCED, RUN_STATUS.READY]).has(current.status)) throw new Error("Preflight requires a category-synced run.");
    const targetMismatch = !current.targetFingerprint || current.targetFingerprint !== result.targetFingerprint;
    if (targetMismatch && result.ok) throw new Error("Preflight target does not match the run claim.");
    const required = ["snapshotFreeze", "taxonomy", "localAssets", "r2Reset", "r2Upload", "exactSet", "categories", "manifest"];
    const missing = required.filter((stage) => current.stages[stage] !== "ok");
    const blockers = [...new Set([...result.blockers, ...(targetMismatch ? ["TARGET_MISMATCH"] : []), ...(missing.length ? ["REQUIRED_STAGE_MISSING"] : [])])];
    const ready = result.ok && blockers.length === 0;
    const next = {
      ...current,
      status: ready ? RUN_STATUS.READY : RUN_STATUS.CATEGORIES_SYNCED,
      stages: { ...current.stages, preflight: ready ? "ok" : "failed" },
      blockers,
      results: { ...current.results, preflight: { ok: ready, expectedCount: result.expectedCount, targetFingerprint: result.targetFingerprint, blockers } },
    };
    return this.saveAndLoad(next);
  }
  async recordImportOutcome(runId: string, receipt: { targetFingerprint: string; manifestSha256: string; counts: ImportReceiptCounts }): Promise<RunRecord> {
    const current = await this.load(runId);
    if (current.status !== RUN_STATUS.IMPORTING || current.targetFingerprint !== receipt.targetFingerprint || current.manifestSha256 !== receipt.manifestSha256) {
      throw new Error("Import receipt does not match the active approved run.");
    }
    return this.saveAndLoad({ ...current, status: RUN_STATUS.IMPORTED, blockers: [], results: { ...current.results, import: receipt } });
  }
  async confirmReconciledImport(runId: string, receipt: { targetFingerprint: string; manifestSha256: string; counts: ImportReceiptCounts; mismatches: readonly string[] }): Promise<RunRecord> {
    const current = await this.load(runId);
    if (current.status !== RUN_STATUS.RECONCILIATION_REQUIRED) throw new Error("Run is not awaiting import reconciliation.");
    if (receipt.mismatches.length || current.targetFingerprint !== receipt.targetFingerprint || current.manifestSha256 !== receipt.manifestSha256) {
      throw new Error("Read-only reconciliation does not match the approved import.");
    }
    return this.saveAndLoad({
      ...current,
      status: RUN_STATUS.IMPORTED,
      blockers: [],
      results: { ...current.results, import: { targetFingerprint: receipt.targetFingerprint, manifestSha256: receipt.manifestSha256, counts: receipt.counts, reconciled: true } },
    });
  }
  private async saveAndLoad(record: RunRecord): Promise<RunRecord> { await this.save(record); return this.load(record.runId); }
  async freeze(runId: string, source: Uint8Array | string, taxonomy: Uint8Array | string, manifest: Uint8Array | string): Promise<RunRecord> {
    const current = await this.load(runId); if (current.status !== RUN_STATUS.EXTRACTING) throw new Error("Run must be extracting before freeze.");
    await this.writeImmutable(runId, "source.json", source); await this.writeImmutable(runId, "taxonomy.json", taxonomy); await this.writeImmutable(runId, "products.json", manifest);
    return this.transition(runId, RUN_STATUS.SNAPSHOT_FROZEN, { sourceSha256: digest(source), taxonomySha256: digest(taxonomy), manifestSha256: digest(manifest), extractionWindow: { ...(current.extractionWindow ?? { startedAt: current.createdAt }), endedAt: new Date().toISOString() }, stages: { ...current.stages, snapshotFreeze: "ok" } });
  }
  async freezePreparation(runId: string, files: Readonly<Record<"source.json" | "taxonomy.json" | "categories.json" | "products.json" | "inventory.json" | "report.md", Uint8Array | string>>, inventory: readonly z.infer<typeof inventoryItemSchema>[], counts: Record<string, number>, endedAt = new Date().toISOString()): Promise<RunRecord> {
    const current = await this.load(runId);
    if (current.status !== RUN_STATUS.EXTRACTING) throw new Error("Run must be extracting before preparation freeze.");
    const hashes = Object.fromEntries(Object.entries(files).map(([name, payload]) => [name, digest(payload)]));
    try {
      for (const [name, payload] of Object.entries(files)) await this.writeImmutable(runId, name, payload);
      const frozen = await this.transition(runId, RUN_STATUS.SNAPSHOT_FROZEN, {
        sourceSha256: hashes["source.json"], taxonomySha256: hashes["taxonomy.json"], manifestSha256: hashes["products.json"],
        fileDigests: hashes, expectedObjects: [...inventory], counts,
        extractionWindow: { ...(current.extractionWindow ?? { startedAt: current.createdAt }), endedAt },
        blockers: ["HANDOFF_REQUIRED"],
        stages: { ...current.stages, snapshotFreeze: "ok", taxonomy: "ok", localAssets: "ok", exactSet: "ok", manifest: "ok" },
        results: { ...current.results, preparationStatus: "NOT_READY" },
      });
      return await this.transition(runId, RUN_STATUS.ASSETS_VALIDATED, { stages: { ...frozen.stages, localAssets: "ok", exactSet: "ok" } });
    } catch (error) {
      try { await this.transition(runId, RUN_STATUS.FAILED, { blockers: ["PREPARATION_PERSISTENCE_FAILED"] }); } catch { /* keep the original persistence failure */ }
      throw error;
    }
  }
  async assertFrozen(runId: string): Promise<void> { const record = await this.load(runId); if (record.status === RUN_STATUS.FAILED || record.status === RUN_STATUS.CREATED || record.status === RUN_STATUS.EXTRACTING) throw new Error("Run is not frozen."); }
  async writeImmutable(runId: string, file: string, value: Uint8Array | string): Promise<void> {
    const target = this.path(runId, file);
    try { await lstat(target); throw new Error(`Immutable run file already exists: ${file}`); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    const temporary = `${target}.${randomUUID()}.tmp`;
    await writeFile(temporary, value, { flag: "wx", mode: 0o600 });
    try { await link(temporary, target); }
    finally { await unlink(temporary).catch(() => undefined); }
  }
}
