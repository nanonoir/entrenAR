import "dotenv/config";
import { runOperationalHandoff } from "./handoff.command";

runOperationalHandoff(process.argv.slice(2), { output: (value) => process.stdout.write(`${JSON.stringify(value)}\n`) }).then((code) => { process.exitCode = code; });
