import "reflect-metadata";
import { runShowcaseCommand } from "./crm-showcase.command";

const deadline = setTimeout(() => {
  console.error("CRM showcase failed: execution deadline exceeded; inspect destination before retry.");
  process.exit(1);
}, 135_000);
void runShowcaseCommand(process.argv.slice(2)).catch(() => {
  // Raw Prisma/pg/filesystem exceptions may contain credentials or contact data.
  console.error("CRM showcase failed: authorization, prerequisites or transaction rejected. No automatic repair was attempted.");
  process.exitCode = 1;
}).finally(() => clearTimeout(deadline));
