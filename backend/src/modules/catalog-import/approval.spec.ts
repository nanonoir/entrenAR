import { mkdtemp, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { digest, RunStore, RUN_STATUS } from "../catalog-scraper/run/run-store";
import { assertManifestApproval, parseImportApproval, type ImportApproval, type ImportAssetReadinessPort } from "./approval";

async function fixture(): Promise<{ approval: ImportApproval; manifestPath: string; outsidePath: string }> {
  const root = await mkdtemp(join(tmpdir(), "catalog-import-approval-"));
  const runId = "run-approved";
  const store = new RunStore(root);
  const run = await store.allocate(runId);
  const bytes = Buffer.from('{"products":[]}');
  const inventoryBytes = Buffer.from("[]");
  const manifestPath = store.path(runId, "products.json");
  await writeFile(manifestPath, bytes);
  const outsidePath = join(root, "outside.json");
  await writeFile(outsidePath, bytes);
  await store.save({ ...run, status: RUN_STATUS.READY, targetFingerprint: "a".repeat(64), r2DestinationFingerprint: "c".repeat(64), manifestSha256: digest(bytes), fileDigests: { "products.json": digest(bytes), "inventory.json": digest(inventoryBytes) } });
  await writeFile(store.path(runId, "inventory.json"), inventoryBytes);
  return {
    approval: { runId, manifestSha256: digest(bytes), runRoot: root, environment: "a".repeat(64) },
    manifestPath,
    outsidePath,
  };
}

const assetsFor = (fingerprint = "c".repeat(64)): ImportAssetReadinessPort => ({ destinationFingerprint: () => fingerprint, verify: async () => undefined });

function approvalArgs(value: Awaited<ReturnType<typeof fixture>>, overrides: Record<string, string> = {}): string[] {
  return [
    value.manifestPath,
    `--run-id=${overrides["run-id"] ?? value.approval.runId}`,
    `--manifest-sha256=${overrides["manifest-sha256"] ?? value.approval.manifestSha256}`,
    `--run-root=${overrides["run-root"] ?? value.approval.runRoot}`,
    `--confirm-db-fingerprint=${overrides["confirm-db-fingerprint"] ?? value.approval.environment}`,
  ];
}

describe("run-bound catalog import approval", () => {
  it("requires a complete exact flag set and rejects unknown or duplicate flags", async () => {
    const value = await fixture();
    expect(parseImportApproval(approvalArgs(value))).toMatchObject({ approval: value.approval, filePath: value.manifestPath });
    expect(() => parseImportApproval([value.manifestPath])).toThrow("incomplete");
    expect(() => parseImportApproval([...approvalArgs(value), "--unexpected=value"])).toThrow("incomplete");
    expect(() => parseImportApproval([...approvalArgs(value), `--run-id=${value.approval.runId}`])).toThrow("duplicate");
  });

  it("requires the exact run-owned manifest, digest, READY status, target, and empty Product table", async () => {
    const value = await fixture();
    const target = { environmentFingerprint: async () => value.approval.environment, productCount: async () => 0 };
    await expect(assertManifestApproval(value.manifestPath, value.approval, target, assetsFor())).resolves.toBeUndefined();
    await expect(assertManifestApproval(value.outsidePath, value.approval, target, assetsFor())).rejects.toThrow("owned by the approved run");
    await expect(assertManifestApproval(value.manifestPath, { ...value.approval, manifestSha256: "b".repeat(64) }, target, assetsFor())).rejects.toThrow("Manifest digest does not match approval.");
    await expect(assertManifestApproval(value.manifestPath, value.approval, { ...target, environmentFingerprint: async () => "b".repeat(64) }, assetsFor())).rejects.toThrow("target does not match");
    await expect(assertManifestApproval(value.manifestPath, value.approval, { ...target, productCount: async () => 1 }, assetsFor())).rejects.toThrow("not empty");
    await expect(assertManifestApproval(value.manifestPath, value.approval, target, assetsFor("d".repeat(64)))).rejects.toThrow("R2 destination");
  });

  it("rejects symlinked manifests and digest changes before import", async () => {
    const value = await fixture();
    const store = new RunStore(value.approval.runRoot);
    await writeFile(store.path(value.approval.runId, "products.json"), "changed");
    const target = { environmentFingerprint: async () => value.approval.environment, productCount: async () => 0 };
    await expect(assertManifestApproval(value.manifestPath, value.approval, target, assetsFor())).rejects.toThrow("digest");

    const second = await fixture();
    const secondStore = new RunStore(second.approval.runRoot);
    await writeFile(second.outsidePath, "outside");
    try {
      await import("node:fs/promises").then(({ unlink }) => unlink(secondStore.path(second.approval.runId, "products.json")));
      await symlink(second.outsidePath, secondStore.path(second.approval.runId, "products.json"));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EPERM") return;
      throw error;
    }
    await expect(assertManifestApproval(secondStore.path(second.approval.runId, "products.json"), second.approval, target, assetsFor())).rejects.toThrow();
  });

  it("rejects a run that is no longer READY", async () => {
    const value = await fixture();
    const store = new RunStore(value.approval.runRoot);
    await store.save({ ...(await store.load(value.approval.runId)), status: RUN_STATUS.ASSETS_VALIDATED });
    const target = { environmentFingerprint: async () => value.approval.environment, productCount: async () => 0 };
    await expect(assertManifestApproval(value.manifestPath, value.approval, target, assetsFor())).rejects.toThrow("not READY");
  });
});
