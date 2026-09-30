import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export interface PipelineReport {
  readiness: "READY" | "NOT_READY";
  stages: Record<string, "pending" | "ok" | "failed">;
  counts: Record<string, number>;
  exclusions: Array<{ code: string; product?: string; message: string }>;
  warnings: string[];
  blockers: string[];
  timingsMs: Record<string, number>;
  runId?: string;
  manifestSha256?: string;
  targetFingerprint?: string;
  expectedObjects?: number;
  observationWindow?: { startedAt: string; endedAt?: string };
  outcomes: Array<{ url: string; result: "ACCEPTED" | "EXCLUDED" | "EXTRACTION_FAILED"; reason: string }>;
}

export function createPipelineReport(): PipelineReport {
  return { readiness: "NOT_READY", stages: {}, counts: {}, exclusions: [], warnings: [], blockers: [], timingsMs: {}, outcomes: [] };
}

export async function writePipelineOutputs(outputDirectory: string, categories: unknown, products: unknown, report: PipelineReport): Promise<void> {
  await mkdir(outputDirectory, { recursive: true });
  await Promise.all([
    writeJson(`${outputDirectory}/categories.json`, categories),
    writeJson(`${outputDirectory}/products.json`, products),
    writeFile(`${outputDirectory}/report.md`, renderReport(report), "utf8"),
  ]);
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function renderReport(report: PipelineReport): string {
  const safe = (value: string) => value.replace(/([A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|ACCESS_KEY)[A-Z0-9_]*|secret-token|Bearer\s+\S+|https?:\/\/\S+)/gi, "[REDACTED]");
  const observations = report.observationWindow ? [`- Observation window: ${report.observationWindow.startedAt} to ${report.observationWindow.endedAt ?? "incomplete"}`, "- Source consistency: bounded observation window; not an atomic snapshot"] : [];
  const outcomes = report.outcomes.map((entry) => `- ${sanitizePublicUrl(entry.url)} — ${entry.result}: ${safe(entry.reason)}`);
  const counts = Object.entries(report.counts).sort(([left], [right]) => left.localeCompare(right)).map(([key, value]) => `- ${safe(key)}: ${value}`);
  return ["# Catalog scraper report", "", `- Readiness: **${report.readiness}**`, ...(report.runId ? [`- Run: **${safe(report.runId)}**`] : []), ...(report.manifestSha256 ? [`- Manifest digest: **${safe(report.manifestSha256)}**`] : []), ...observations, "", "## Counts", ...(counts.length ? counts : ["- None"]), "", "## Outcomes", ...(outcomes.length ? outcomes : ["- None"]), "", "## Blockers", ...(report.blockers.length ? report.blockers.map((value) => `- ${safe(value)}`) : ["- None"]), "", "## Warnings", ...(report.warnings.length ? report.warnings.map((value) => `- ${safe(value)}`) : ["- None"]), "", "## Exclusions", ...(report.exclusions.length ? report.exclusions.map((value) => `- ${safe(value.code)}: ${safe(value.message)}`) : ["- None"])].join("\n");
}

function sanitizePublicUrl(value: string): string {
  try { const url = new URL(value); return `${url.origin}${url.pathname}`; }
  catch { return "[invalid-url]"; }
}
