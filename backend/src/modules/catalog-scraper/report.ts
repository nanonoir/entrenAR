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
}

export function createPipelineReport(): PipelineReport {
  return { readiness: "NOT_READY", stages: {}, counts: {}, exclusions: [], warnings: [], blockers: [], timingsMs: {} };
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
  const safe = (value: string) => value.replace(/([A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|ACCESS_KEY)[A-Z0-9_]*|secret-token|Bearer\s+\S+)/gi, "[REDACTED]");
  return ["# Catalog scraper report", "", `- Readiness: **${report.readiness}**`, `- Exclusions: ${report.exclusions.length}`, `- Warnings: ${report.warnings.length}`, "", "## Blockers", ...(report.blockers.length ? report.blockers.map((value) => `- ${safe(value)}`) : ["- None"]), "", "## Warnings", ...(report.warnings.length ? report.warnings.map((value) => `- ${safe(value)}`) : ["- None"]), "", "## Exclusions", ...(report.exclusions.length ? report.exclusions.map((value) => `- ${safe(value.code)}: ${safe(value.message)}`) : ["- None"])].join("\n");
}
