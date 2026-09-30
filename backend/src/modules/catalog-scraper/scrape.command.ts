import "reflect-metadata";
import { basename, resolve } from "node:path";
import { RunStore } from "./run/run-store";
import { prepareRun } from "./run/prepare-run";

export async function runCatalogScrapeCommand(sitemapUrl = process.argv[2], outputDirectory = process.argv[3] ?? defaultOutputDirectory()): Promise<number> {
  if (!sitemapUrl) return 2;
  const result = await prepareRun(sitemapUrl, {
    store: new RunStore(outputDirectory),
    fetcher: { request: (url, init) => fetch(url, init) },
  });
  console.log(JSON.stringify({ code: result.status, readiness: result.report.readiness, runId: result.runId }));
  return result.status === "FAILED" ? 2 : 0;
}

function defaultOutputDirectory(): string {
  const workingDirectory = process.cwd();
  return resolve(workingDirectory, basename(workingDirectory).toLowerCase() === "backend" ? ".." : ".", "scrape-output");
}
