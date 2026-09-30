import { DeleteObjectsCommand, HeadObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createHash } from "node:crypto";
import { assertProductsPrefix, readR2Environment, type ObjectMetadata, type R2StoragePort } from "./r2-storage";

export interface PublicHeadResponse { ok: boolean; status: number; headers?: Headers }
export interface S3R2StorageOptions { client?: S3Client; publicFetch?: typeof fetch; environment?: ReturnType<typeof readR2Environment> }

export class S3R2StorageAdapter implements R2StoragePort {
  private readonly environment: ReturnType<typeof readR2Environment>;
  private readonly client: S3Client;
  private readonly publicFetch: typeof fetch;

  constructor(options: S3R2StorageOptions = {}) {
    this.environment = options.environment ?? readR2Environment();
    this.client = options.client ?? new S3Client({ endpoint: this.environment.endpoint, region: "auto", credentials: { accessKeyId: this.environment.accessKeyId, secretAccessKey: this.environment.secretAccessKey } });
    this.publicFetch = options.publicFetch ?? fetch;
  }

  destinationFingerprint(): string {
    const identity = [this.environment.accountId, this.environment.bucket, this.environment.endpoint, this.environment.publicBaseUrl].join("\n");
    return createHash("sha256").update(identity).digest("hex");
  }

  async list(prefix: string, cursor?: string): Promise<{ objects: ObjectMetadata[]; nextCursor?: string }> {
    assertProductsPrefix(prefix);
    const result = await this.client.send(new ListObjectsV2Command({ Bucket: this.environment.bucket, Prefix: prefix, ContinuationToken: cursor }));
    return { objects: (result.Contents ?? []).flatMap((item) => item.Key ? [{ key: item.Key, size: item.Size ?? 0 }] : []), nextCursor: result.IsTruncated ? result.NextContinuationToken : undefined };
  }

  async delete(keys: readonly string[]): Promise<void> {
    if (keys.some((key) => !key.startsWith("products/"))) throw new Error("R2 mutation is restricted to products/.");
    for (let index = 0; index < keys.length; index += 1000) await this.client.send(new DeleteObjectsCommand({ Bucket: this.environment.bucket, Delete: { Objects: keys.slice(index, index + 1000).map((Key) => ({ Key })) } }));
  }

  async put(object: { key: string; bytes: Uint8Array; contentType: string }): Promise<void> {
    assertProductsPrefix(object.key.slice(0, object.key.indexOf("/") + 1));
    await this.client.send(new PutObjectCommand({ Bucket: this.environment.bucket, Key: object.key, Body: object.bytes, ContentType: object.contentType, Metadata: { sha256: createHash("sha256").update(object.bytes).digest("hex") } }));
  }

  async head(key: string, publicRequest = false): Promise<ObjectMetadata | null> {
    if (!publicRequest) {
      try { const result = await this.client.send(new HeadObjectCommand({ Bucket: this.environment.bucket, Key: key })); return { key, size: result.ContentLength ?? 0, sha256: result.Metadata?.["sha256"], contentType: result.ContentType }; }
      catch (error) { if (isNotFound(error)) return null; throw new Error("R2 authenticated HEAD failed."); }
    }
    const response: PublicHeadResponse = await this.publicFetch(`${this.environment.publicBaseUrl.replace(/\/$/, "")}/${key}`, { method: "HEAD" });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error("R2 public HEAD failed.");
    return { key, size: Number(response.headers?.get("content-length") ?? 0), contentType: response.headers?.get("content-type") ?? undefined };
  }
}

function isNotFound(error: unknown): boolean { return typeof error === "object" && error !== null && "$metadata" in error && (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404; }
