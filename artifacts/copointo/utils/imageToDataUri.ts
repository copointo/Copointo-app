import type { ImagePickerAsset } from "expo-image-picker";

/**
 * Convert an ImagePicker asset to a stable data URI so it can be persisted
 * and rendered later. Native blob:/file:// URIs from ImagePicker can become
 * invalid after the picker session ends, which makes avatars vanish on
 * re-render. This helper:
 *   1. Uses asset.base64 directly when present (fastest).
 *   2. Falls back to fetch + FileReader to read the raw bytes into a
 *      base64 data URI when base64 is missing.
 *   3. As a last resort returns the original uri (mostly works on web).
 *
 * Returns null only if every path fails.
 */
export async function assetToDataUri(asset: ImagePickerAsset): Promise<string | null> {
  const mime = asset.mimeType || "image/jpeg";
  if (asset.base64) {
    return `data:${mime};base64,${asset.base64}`;
  }
  if (asset.uri) {
    try {
      const resp = await fetch(asset.uri);
      const blob = await resp.blob();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload  = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
    } catch {
      return asset.uri;
    }
  }
  return null;
}
