import { runCatalogCategorySyncCommand } from "./category-sync.command";

void runCatalogCategorySyncCommand().then((code) => { process.exitCode = code; });
