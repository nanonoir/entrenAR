import { runCatalogScrapeCommand } from "./scrape.command";

void runCatalogScrapeCommand().then((code) => { process.exitCode = code; });
