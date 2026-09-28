import "reflect-metadata";
import { discoverProductUrls, fetchWithRetry, mapBounded, parseProductHtml } from "./scraper";
import { transformProducts } from "./transformer";
import { createPipelineReport, writePipelineOutputs } from "./report";

export async function runCatalogScrapeCommand(sitemapUrl = process.argv[2], outputDirectory = process.argv[3] ?? "scrape-output"): Promise<number> {
  const report = createPipelineReport();
  if (!sitemapUrl) { report.blockers.push("A sitemap URL is required."); await writePipelineOutputs(outputDirectory, [], { products: [] }, report); return 2; }
  try {
    const sitemap = await fetchWithRetry(sitemapUrl);
    if (sitemap.status !== 200) throw new Error("Sitemap request failed.");
    const discovered = discoverProductUrls(await sitemap.text());
    report.counts.discovered = discovered.urls.length;
    report.counts.duplicateUrls = discovered.duplicates;
    const extracted = await mapBounded(discovered.urls, async (url) => {
      const response = await fetchWithRetry(url);
      if (response.status !== 200) throw new Error(`Source returned ${response.status}.`);
      return parseProductHtml(url, await response.text());
    });
    const result = transformProducts(extracted);
    report.exclusions.push(...result.exclusions);
    report.warnings.push(...result.warnings);
    report.counts.products = result.manifest?.products.length ?? 0;
    report.readiness = result.manifest ? "READY" : "NOT_READY";
    report.stages.discovery = "ok";
    report.stages.transformation = result.manifest ? "ok" : "failed";
    await writePipelineOutputs(outputDirectory, [], result.manifest ?? { products: [] }, report);
    return report.readiness === "READY" ? 0 : 2;
  } catch (error) {
    report.blockers.push(error instanceof Error ? error.message : "Scrape failed.");
    await writePipelineOutputs(outputDirectory, [], { products: [] }, report);
    return 2;
  }
}
