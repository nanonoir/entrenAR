import { createHash } from "node:crypto";

export const R2_PREFIX = "products/" as const;
const VERIFY_CONCURRENCY = 8;
export interface ObjectMetadata { key: string; size: number; sha256?: string; contentType?: string }
export interface R2StoragePort { list(prefix: string, cursor?: string): Promise<{ objects: ObjectMetadata[]; nextCursor?: string }>; delete(keys: readonly string[]): Promise<void>; put(object: { key: string; bytes: Uint8Array; contentType: string }): Promise<void>; head(key: string, publicRequest?: boolean): Promise<ObjectMetadata | null>; destinationFingerprint?(): string }
export interface R2ResetConfirmation { runId: string; environment: string; destinationFingerprint: string; prefix: string; manifestSha256: string }

export function assertProductsPrefix(prefix: string): void { if (prefix !== R2_PREFIX) throw new Error("R2 mutation is restricted to products/."); }
export interface R2Environment { accountId: string; accessKeyId: string; secretAccessKey: string; bucket: string; endpoint: string; publicBaseUrl: string }
export function readR2Environment(env: NodeJS.ProcessEnv = process.env): R2Environment {
  const values = { accountId: env["R2_ACCOUNT_ID"], accessKeyId: env["R2_ACCESS_KEY_ID"], secretAccessKey: env["R2_SECRET_ACCESS_KEY"], bucket: env["R2_BUCKET_NAME"], endpoint: env["R2_ENDPOINT"], publicBaseUrl: env["ASSETS_BASE_URL"] };
  if (Object.values(values).some((value) => !value)) throw new Error("R2 configuration is incomplete.");
  return values as R2Environment;
}
export async function listAll(storage: R2StoragePort, prefix: string = R2_PREFIX): Promise<ObjectMetadata[]> { assertProductsPrefix(prefix); const objects: ObjectMetadata[] = []; let cursor: string | undefined; do { const page = await storage.list(prefix, cursor); objects.push(...page.objects); cursor = page.nextCursor; } while (cursor); return objects; }
export async function resetProductsPrefix(storage: R2StoragePort, confirmation: R2ResetConfirmation): Promise<void> { assertProductsPrefix(confirmation.prefix); const objects = await listAll(storage, confirmation.prefix); if (objects.length) await storage.delete(objects.map((object) => object.key)); if ((await listAll(storage, confirmation.prefix)).length) throw new Error("R2 products/ prefix is not empty after reset."); }
export async function uploadExactSet(storage: R2StoragePort, objects: readonly { key: string; bytes: Uint8Array; contentType: string }[]): Promise<void> { for (const object of objects) { assertProductsPrefix(object.key.slice(0, object.key.indexOf("/") + 1)); await storage.put(object); } const actual = await listAll(storage); const expected = new Map(objects.map((object) => [object.key, { size: object.bytes.byteLength, sha256: createHash("sha256").update(object.bytes).digest("hex") }])); const extras = actual.filter((object) => !expected.has(object.key)); const missing = [...expected.keys()].filter((key) => !actual.some((object) => object.key === key)); if (extras.length || missing.length) throw new Error(`R2 exact set mismatch: ${missing.length} missing, ${extras.length} extra.`); }
export async function verifyExactSet(storage: R2StoragePort, expected: readonly ObjectMetadata[], publicHead = true): Promise<void> {
  const actual = await listAll(storage);
  const expectedKeys = new Set(expected.map((object) => object.key));
  const actualKeys = new Set(actual.map((object) => object.key));
  const missing = expected.filter((object) => !actualKeys.has(object.key));
  const extra = actual.filter((object) => !expectedKeys.has(object.key));
  if (missing.length || extra.length) throw new Error(`R2 exact set mismatch: ${missing.length} missing, ${extra.length} extra.`);
  for (const item of expected) if (!item.sha256 || !Number.isInteger(item.size) || item.size < 0) throw new Error(`R2 expected integrity metadata is incomplete: ${item.key}`);

  let nextIndex = 0;
  let failed = false;
  let failure: unknown;
  const verifyOne = async (item: ObjectMetadata): Promise<void> => {
    const authenticated = await storage.head(item.key);
    if (!authenticated || authenticated.size !== item.size || authenticated.sha256 !== item.sha256) throw new Error(`R2 integrity mismatch: ${item.key}`);
    if (!publicHead) return;
    let publicObject: ObjectMetadata | null;
    try { publicObject = await storage.head(item.key, true); }
    catch { throw new Error("R2 public object unavailable: public HEAD failed."); }
    if (!publicObject) throw new Error(`R2 public object unavailable: ${item.key}`);
  };
  const worker = async (): Promise<void> => {
    while (!failed) {
      const index = nextIndex++;
      if (index >= expected.length) return;
      try { await verifyOne(expected[index]!); }
      catch (error) { failed = true; failure = error; }
    }
  };
  await Promise.all(Array.from({ length: Math.min(VERIFY_CONCURRENCY, expected.length) }, worker));
  if (failed) throw failure;
}
