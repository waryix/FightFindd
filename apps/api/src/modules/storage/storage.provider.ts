import { randomUUID } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { loadEnv } from "../../env.js";

export interface StoredFile {
  key: string;
  url: string;
}

export interface SaveFileInput {
  buffer: Buffer;
  filename: string;
  contentType: string;
  prefix: string;
}

/**
 * Storage abstraction. Local disk for development; any S3-compatible bucket
 * for production (`STORAGE_DRIVER=s3`). Routes never touch the filesystem
 * directly, so swapping providers is a configuration change.
 */
export interface StorageProvider {
  save(input: SaveFileInput): Promise<StoredFile>;
  delete(key: string): Promise<void>;
}

const EXTENSION_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
};

export const MAX_UPLOAD_BYTES = 6 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = Object.keys(EXTENSION_BY_TYPE);

function safeKey(prefix: string, contentType: string): string {
  const ext = EXTENSION_BY_TYPE[contentType] ?? "bin";
  const cleanPrefix = prefix.replace(/[^a-zA-Z0-9/_-]/g, "");
  return `${cleanPrefix}/${randomUUID()}.${ext}`;
}

export class LocalStorageProvider implements StorageProvider {
  constructor(private readonly baseDir: string, private readonly publicBaseUrl: string) {}

  async save(input: SaveFileInput): Promise<StoredFile> {
    const key = safeKey(input.prefix, input.contentType);
    const target = path.join(this.baseDir, key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, input.buffer);
    return { key, url: `${this.publicBaseUrl}/uploads/${key}` };
  }

  async delete(key: string): Promise<void> {
    const target = path.join(this.baseDir, key);
    await unlink(target).catch(() => undefined);
  }
}

export async function createStorageProvider(): Promise<StorageProvider> {
  const env = loadEnv();
  if (env.STORAGE_DRIVER === "s3") {
    const { S3StorageProvider } = await import("./s3.storage.js");
    return S3StorageProvider.fromEnv();
  }
  return new LocalStorageProvider(env.STORAGE_LOCAL_DIR, env.API_PUBLIC_URL);
}
