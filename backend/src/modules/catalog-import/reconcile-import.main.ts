import "reflect-metadata";
import "dotenv/config";
import { runCatalogImportReconciliation } from "./reconcile-import.command";

void runCatalogImportReconciliation().then((code) => { process.exitCode = code; });
