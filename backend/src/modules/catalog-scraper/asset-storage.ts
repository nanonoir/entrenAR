import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { readR2Environment } from "./storage/r2-storage";

export interface AssetObject { key: string; contentType: string; bytes: Uint8Array }
export interface AssetStoragePort { put(object: AssetObject): Promise<void>; exists(key: string): Promise<boolean>; delete(key: string): Promise<void>; get(key: string): Promise<Uint8Array> }
export interface GalleryResponse { status: number; contentType: string; arrayBuffer(): Promise<ArrayBuffer> }

export function createR2StorageFromEnvironment(): AssetStoragePort {
  const { accessKeyId, secretAccessKey, bucket, endpoint } = readR2Environment();
  const client = new S3Client({ endpoint, region: "auto", credentials: { accessKeyId, secretAccessKey } });
  return {
    async put(object) { await client.send(new PutObjectCommand({ Bucket: bucket, Key: object.key, Body: object.bytes, ContentType: object.contentType })); },
    async exists(key) {
      try { await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key })); return true; } catch (error) {
        if (isNotFound(error)) return false;
        throw error;
      }
    },
    async delete(key) { await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })); },
    async get(key) {
      const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      if (!result.Body) throw new Error("R2 object has no body.");
      return new Uint8Array(await result.Body.transformToByteArray());
    },
  };
}

export async function validateWebp(bytes: Uint8Array, contentType: string): Promise<boolean> {
  if (bytes.byteLength > 10 * 1024 * 1024) return false;
  const riff = String.fromCharCode(...bytes.slice(0, 4)) === "RIFF";
  const webp = String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  return riff && webp && /image\/(webp|x-webp)/i.test(contentType);
}

export async function uploadValidatedGalleryImage(storage: AssetStoragePort, productSlug: string, position: number, response: GalleryResponse): Promise<string> {
  if (response.status !== 200) throw new Error("INVALID_IMAGE_ASSET");
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!await validateWebp(bytes, response.contentType)) throw new Error("INVALID_IMAGE_ASSET");
  const key = `products/${productSlug}/${position}.webp`;
  await storage.put({ key, contentType: "image/webp", bytes });
  return key;
}

function isNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "$metadata" in error && (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404;
}
