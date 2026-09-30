import "dotenv/config";
import { S3R2StorageAdapter } from "./storage/s3-r2-storage.adapter";
import { runStorageCommand } from "./storage/storage.command";

const mode = process.argv[2];
if (mode === "fingerprint") {
  try { process.stdout.write(JSON.stringify({ ok: true, code: "R2_DESTINATION_FINGERPRINT", destinationFingerprint: new S3R2StorageAdapter().destinationFingerprint() }) + "\n"); }
  catch { process.stdout.write(JSON.stringify({ ok: false, code: "R2_CONFIGURATION_FAILED" }) + "\n"); process.exitCode = 2; }
} else if (mode !== "reset" && mode !== "upload" && mode !== "reconcile") { process.stdout.write(JSON.stringify({ ok: false, code: "MISSING_OPERATION" }) + "\n"); process.exitCode = 2; }
else runStorageCommand(mode, process.argv.slice(3), { storage: new S3R2StorageAdapter(), output: (value) => process.stdout.write(`${JSON.stringify(value)}\n`) }).then((code) => { process.exitCode = code; });
