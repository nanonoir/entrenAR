import { runCatalogCutoverCommand } from "./catalog-cutover.command";

runCatalogCutoverCommand().then((code) => {
  process.exitCode = code;
}).catch(() => {
  process.stdout.write(`${JSON.stringify({ ok: false, code: "CUTOVER_BLOCKED", message: "Cutover prerequisites are missing, stale, or unsafe." })}\n`);
  process.exitCode = 2;
});
