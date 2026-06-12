import { mkdir, writeFile } from "fs/promises";
import path from "path";

/**
 * Abstraksi penyimpanan file upload.
 * - Env R2_* terisi (production/Vercel) → Cloudflare R2 via API S3-compatible.
 * - Env kosong (dev lokal) → disk <root>/uploads, disajikan via /api/uploads.
 * Pindah provider (S3/MinIO/dsb.) cukup ganti endpoint — antarmuka tetap.
 */

export type SavedFile = { url: string };

function r2Config() {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL } = process.env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET || !R2_PUBLIC_URL) return null;
  return {
    accountId: R2_ACCOUNT_ID,
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
    bucket: R2_BUCKET,
    publicUrl: R2_PUBLIC_URL.replace(/\/$/, ""),
  };
}

export function storageMode(): "r2" | "local" {
  return r2Config() ? "r2" : "local";
}

export async function saveUpload(
  folder: string,
  filename: string,
  body: Buffer,
  contentType: string
): Promise<SavedFile> {
  const key = `${folder}/${filename}`;
  const r2 = r2Config();

  if (r2) {
    const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
    const client = new S3Client({
      region: "auto",
      endpoint: `https://${r2.accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: r2.accessKeyId, secretAccessKey: r2.secretAccessKey },
    });
    await client.send(
      new PutObjectCommand({ Bucket: r2.bucket, Key: key, Body: body, ContentType: contentType })
    );
    return { url: `${r2.publicUrl}/${key}` };
  }

  // Fallback dev lokal: tulis ke disk (catatan: tidak berfungsi di serverless)
  const dir = path.join(process.cwd(), "uploads", folder);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), body);
  return { url: `/api/uploads/${key}` };
}
