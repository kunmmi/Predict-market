/**
 * Storage / CDN provider interface.
 *
 * Current state: No file storage integrated. Not yet needed.
 *
 * When file uploads are needed (KYC documents, market images, etc.):
 *   1. Pick a provider suitable for your region:
 *      GLOBAL → Vercel Blob, AWS S3, Cloudflare R2
 *      CN     → Alibaba Cloud OSS (阿里云OSS), Tencent Cloud COS (腾讯云COS)
 *   2. Create an adapter in lib/services/adapters/storage/<provider>.ts
 *      that implements this interface.
 *   3. Register it in lib/services/registry.ts.
 *   4. Set STORAGE_PROVIDER and related env vars.
 *
 * CN note: S3 and Cloudflare R2 are accessible from CN but may have
 * latency issues. For best performance with CN users, prefer OSS or COS
 * with a domestic CDN layer.
 */

export interface UploadFileParams {
  /**
   * Storage key / path (e.g. 'kyc/user-123/passport.jpg').
   * Must be unique per file — use UUIDs or content-hashed names.
   */
  key: string;
  data: Buffer | Blob | ArrayBuffer;
  contentType: string;
  /** Whether the file should be publicly accessible via URL. Default: false */
  isPublic?: boolean;
}

export interface StorageFile {
  key: string;
  /** Public URL (only set if isPublic was true) */
  url: string;
  /** File size in bytes */
  size: number;
}

export interface StorageProvider {
  /** Upload a file and return its storage metadata. */
  upload(params: UploadFileParams): Promise<StorageFile>;

  /** Delete a file by key. */
  delete(key: string): Promise<void>;

  /**
   * Get the public URL for a file.
   * Returns an empty string if the file is not publicly accessible.
   */
  getUrl(key: string): string;
}
