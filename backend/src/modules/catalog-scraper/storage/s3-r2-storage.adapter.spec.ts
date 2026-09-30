import { S3R2StorageAdapter } from "./s3-r2-storage.adapter";
import type { S3Client } from "@aws-sdk/client-s3";

const environment = { accountId: "account", accessKeyId: "key", secretAccessKey: "secret", bucket: "bucket", endpoint: "https://r2.example", publicBaseUrl: "https://assets.example" };

describe("S3 R2 storage adapter", () => {
  it("computes a stable non-secret destination fingerprint", () => {
    const first = new S3R2StorageAdapter({ client: { send: jest.fn() } as unknown as S3Client, environment, publicFetch: jest.fn() as typeof fetch });
    const same = new S3R2StorageAdapter({ client: { send: jest.fn() } as unknown as S3Client, environment: { ...environment }, publicFetch: jest.fn() as typeof fetch });
    const other = new S3R2StorageAdapter({ client: { send: jest.fn() } as unknown as S3Client, environment: { ...environment, bucket: "other-bucket" }, publicFetch: jest.fn() as typeof fetch });
    expect(first.destinationFingerprint()).toBe(same.destinationFingerprint());
    expect(first.destinationFingerprint()).not.toBe(other.destinationFingerprint());
    expect(first.destinationFingerprint()).not.toContain(environment.secretAccessKey);
  });

  it("follows list pagination", async () => {
    const send = jest.fn().mockResolvedValueOnce({ Contents: [{ Key: "products/a/1.webp", Size: 3, ETag: '"etag-a"' }], IsTruncated: true, NextContinuationToken: "next" }).mockResolvedValueOnce({ Contents: [{ Key: "products/b/1.webp", Size: 4 }], IsTruncated: false });
    const adapter = new S3R2StorageAdapter({ client: { send } as unknown as S3Client, environment, publicFetch: jest.fn() as typeof fetch });
    await expect(adapter.list("products/")).resolves.toEqual({ objects: [{ key: "products/a/1.webp", size: 3 }], nextCursor: "next" });
    await expect(adapter.list("products/", "next")).resolves.toEqual({ objects: [{ key: "products/b/1.webp", size: 4 }], nextCursor: undefined });
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("batches deletion at the S3 limit and persists SHA metadata", async () => {
    const send = jest.fn().mockResolvedValue({});
    const adapter = new S3R2StorageAdapter({ client: { send } as unknown as S3Client, environment, publicFetch: jest.fn() as typeof fetch });
    const keys = Array.from({ length: 1001 }, (_, index) => `products/item/${index}.webp`);
    await adapter.delete(keys);
    expect(send).toHaveBeenCalledTimes(2);
    expect((send.mock.calls[0][0] as { input: { Delete: { Objects: unknown[] } } }).input.Delete.Objects).toHaveLength(1000);
    await adapter.put({ key: "products/item/1.webp", bytes: Uint8Array.of(1, 2), contentType: "image/webp" });
    const input = (send.mock.calls[2][0] as { input: { Metadata: { sha256: string } } }).input;
    expect(input.Metadata.sha256).toBe("a12871fee210fb8619291eaea194581cbd2531e4b23759d225f6806923f63222");
  });

  it("handles authenticated and public HEAD results safely", async () => {
    const send = jest.fn().mockResolvedValueOnce({ ContentLength: 2, ContentType: "image/webp", Metadata: { sha256: "digest" } }).mockRejectedValueOnce({ $metadata: { httpStatusCode: 404 } });
    const publicFetch = jest.fn().mockResolvedValue({ ok: true, status: 200, headers: new Headers({ "content-length": "2", "content-type": "image/webp" }) });
    const adapter = new S3R2StorageAdapter({ client: { send } as unknown as S3Client, environment, publicFetch: publicFetch as typeof fetch });
    await expect(adapter.head("products/item/1.webp")).resolves.toMatchObject({ size: 2, sha256: "digest" });
    await expect(adapter.head("products/missing/1.webp")).resolves.toBeNull();
    await expect(adapter.head("products/item/1.webp", true)).resolves.toMatchObject({ size: 2 });
    expect(publicFetch).toHaveBeenCalledWith("https://assets.example/products/item/1.webp", { method: "HEAD" });
  });

  it("rejects escaped mutation prefixes and public failures", async () => {
    const send = jest.fn().mockResolvedValue({});
    const publicFetch = jest.fn().mockResolvedValue({ ok: false, status: 500 });
    const adapter = new S3R2StorageAdapter({ client: { send } as unknown as S3Client, environment, publicFetch: publicFetch as typeof fetch });
    await expect(adapter.delete(["other/file.webp"])).rejects.toThrow("products/");
    await expect(adapter.put({ key: "other/file.webp", bytes: Uint8Array.of(1), contentType: "image/webp" })).rejects.toThrow("products/");
    await expect(adapter.head("products/item/1.webp", true)).rejects.toThrow("public HEAD");
  });
});
