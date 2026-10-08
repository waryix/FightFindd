import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { loadEnv } from "../../env.js";
import {
  MAX_UPLOAD_BYTES,
  type SaveFileInput,
  type StorageProvider,
  type StoredFile,
} from "./storage.provider.js";

/** S3-compatible storage (AWS S3, Cloudflare R2, MinIO, …). */
export class S3StorageProvider implements StorageProvider {
  private constructor(
    private readonly client: S3Client,
    private readonly bucket: string,
    private readonly publicBaseUrl: string,
  ) {}

  static fromEnv(): S3StorageProvider {
    const env = loadEnv();
    if (!env.S3_BUCKET || !env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY) {
      throw new Error("STORAGE_DRIVER=s3 requires S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY");
    }
    const client = new S3Client({
      region: env.S3_REGION,
      endpoint: env.S3_ENDPOINT || undefined,
      forcePathStyle: Boolean(env.S3_ENDPOINT),
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      },
    });
    return new S3StorageProvider(client, env.S3_BUCKET, env.S3_PUBLIC_BASE_URL || "");
  }

  async save(input: SaveFileInput): Promise<StoredFile> {
    if (input.buffer.byteLength > MAX_UPLOAD_BYTES) {
      throw new Error("File too large");
    }
    const ext = input.contentType.split("/")[1]?.replace("jpeg", "jpg") ?? "bin";
    const key = `${input.prefix.replace(/[^a-zA-Z0-9/_-]/g, "")}/${crypto.randomUUID()}.${ext}`;
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: input.buffer,
        ContentType: input.contentType,
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
    const base = this.publicBaseUrl || `https://${this.bucket}.s3.amazonaws.com`;
    return { key, url: `${base.replace(/\/$/, "")}/${key}` };
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key })).catch(() => undefined);
  }
}
