import { runCatalogScrapeCommand } from "./scrape.command";

void runCatalogScrapeCommand(process.argv[2], process.argv[3]).then((code) => { process.exitCode = code; });
