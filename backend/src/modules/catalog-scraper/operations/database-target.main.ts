import "dotenv/config";
import { reportDatabaseTarget } from "./database-target";

try {
  process.stdout.write(`${JSON.stringify({ ok: true, code: "DATABASE_TARGET", target: reportDatabaseTarget() })}\n`);
} catch {
  process.stdout.write(`${JSON.stringify({ ok: false, code: "DATABASE_TARGET_CONFIGURATION_FAILED" })}\n`);
  process.exitCode = 2;
}
