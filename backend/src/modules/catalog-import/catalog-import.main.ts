import "reflect-metadata";

import { runCatalogImportCommand } from "./catalog-import.command";

runCatalogImportCommand().then((exitCode) => { process.exitCode = exitCode; });
