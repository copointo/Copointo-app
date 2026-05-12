import { Storage, type File } from "@google-cloud/storage";
import { randomUUID } from "node:crypto";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

/**
 * GCS client authenticated through the Replit sidecar (no service-account key
 * file needed — auto-configured in every Replit container).
 */
export const gcs = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: { type: "json", subject_token_field_name: "access_token" },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

function privateDir(): string {
  const dir = process.env.PRIVATE_OBJECT_DIR || "";
  if (!dir) throw new Error("PRIVATE_OBJECT_DIR not set");
  return dir.replace(/\/+$/, "");
}

function parse(fullPath: string): { bucketName: string; objectName: string } {
  const p = fullPath.startsWith("/") ? fullPath : `/${fullPath}`;
  const parts = p.split("/").filter(Boolean);
  if (parts.length < 2) throw new Error(`Invalid object path: ${fullPath}`);
  return { bucketName: parts[0]!, objectName: parts.slice(1).join("/") };
}

/**
 * Upload a local file to the bucket under reels/<uuid>.<ext>.
 * Returns the object key (e.g. "reels/abcd-1234.mp4") suitable for storing in
 * the reel's videoUrl as `gcs:<key>`.
 */
export async function uploadReelFile(
  localPath: string,
  ext: string,
  contentType: string,
): Promise<string> {
  const dir = privateDir();
  const safeExt = ext.startsWith(".") ? ext : `.${ext || "mp4"}`;
  const key = `reels/${randomUUID()}${safeExt}`;
  const fullPath = `${dir}/${key}`;
  const { bucketName, objectName } = parse(fullPath);
  await gcs
    .bucket(bucketName)
    .upload(localPath, {
      destination: objectName,
      contentType,
      resumable: false,
      metadata: { cacheControl: "public, max-age=3600" },
    });
  return key;
}

/** Get a GCS file handle for a previously-uploaded reel key. */
export function reelFile(key: string): File {
  const fullPath = `${privateDir()}/${key.replace(/^\/+/, "")}`;
  const { bucketName, objectName } = parse(fullPath);
  return gcs.bucket(bucketName).file(objectName);
}

/** Best-effort delete of a reel file (swallows not-found errors). */
export async function deleteReelFile(key: string): Promise<void> {
  try {
    await reelFile(key).delete({ ignoreNotFound: true });
  } catch {
    /* ignore */
  }
}
