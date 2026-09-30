import { readFile } from "node:fs/promises";
import { digest, RunStore, RUN_STATUS, type RunRecord } from "./run/run-store";

export interface PreflightChecks { targetFingerprint: string; categorySlugs: ReadonlySet<string>; productCount: number; expectedObjectKeys: ReadonlySet<string>; actualObjectKeys: ReadonlySet<string>; }
export interface PreflightResult { ok: boolean; blockers: string[]; run: RunRecord }

export async function runNoWritePreflight(runId: string, checks: PreflightChecks, root = "scrape-output"): Promise<PreflightResult> {
  const store = new RunStore(root); const run = await store.load(runId); const blockers: string[] = [];
  if (!(new Set([RUN_STATUS.CATEGORIES_SYNCED, RUN_STATUS.READY]) as Set<string>).has(run.status)) blockers.push("Run is not category-synced.");
  if (run.targetFingerprint && run.targetFingerprint !== checks.targetFingerprint) blockers.push("Target fingerprint changed.");
  if (checks.productCount !== 0) blockers.push("Catalog import target is not empty.");
  const manifest = JSON.parse(await readFile(store.path(runId, "products.json"), "utf8")) as { products?: Array<{ categorySlugs?: string[]; images?: Array<{ storageKey?: string }> }> };
  if (run.manifestSha256 && digest(JSON.stringify(manifest)) !== run.manifestSha256) blockers.push("Frozen manifest digest changed.");
  const categories = new Set((manifest.products ?? []).flatMap((product) => product.categorySlugs ?? []));
  for (const category of categories) if (!checks.categorySlugs.has(category)) blockers.push(`Unknown category: ${category}`);
  const expected = [...checks.expectedObjectKeys].sort(); const actual = [...checks.actualObjectKeys].sort(); if (JSON.stringify(expected) !== JSON.stringify(actual)) blockers.push("R2 exact object set does not match frozen inventory.");
  const next: RunRecord = { ...run, blockers };
  return { ok: blockers.length === 0, blockers, run: next };
}
