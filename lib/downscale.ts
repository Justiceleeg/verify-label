// Client-side image downscale before upload (ARCHITECTURE "Memory
// discipline"): read File → createImageBitmap → canvas downscale →
// JPEG blob → release. Keeps uploads ~200–400KB and under the API's
// 4MB/image limit regardless of what the user picked.

/** Longest-edge target; matches the architecture doc (~1500px). */
export const MAX_EDGE_PX = 1500;
const JPEG_QUALITY = 0.8;
/** Mirror of the server's per-image cap (app/api/verify/handler.ts). */
const MAX_PASSTHROUGH_BYTES = 4 * 1024 * 1024;

export class DownscaleError extends Error {
  constructor(fileName: string) {
    super(
      `Couldn't read "${fileName}" — it may be corrupt or not an image. Try a different photo.`,
    );
    this.name = "DownscaleError";
  }
}

/** Fit width×height inside max on the longest edge, preserving ratio. */
export function fitWithin(
  width: number,
  height: number,
  max: number,
): { width: number; height: number } {
  if (width <= max && height <= max) return { width, height };
  const scale = max / Math.max(width, height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * Downscale a user-picked image for upload. Returns the original file
 * untouched only when it's already a small-enough JPEG; everything else is
 * re-encoded, which also guarantees the server's MIME allowlist and size cap.
 */
export async function downscaleImage(file: File): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new DownscaleError(file.name);
  }

  try {
    if (
      file.type === "image/jpeg" &&
      bitmap.width <= MAX_EDGE_PX &&
      bitmap.height <= MAX_EDGE_PX &&
      file.size <= MAX_PASSTHROUGH_BYTES
    ) {
      return file;
    }

    const { width, height } = fitWithin(bitmap.width, bitmap.height, MAX_EDGE_PX);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new DownscaleError(file.name);
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
    );
    if (!blob) throw new DownscaleError(file.name);
    return blob;
  } finally {
    bitmap.close();
  }
}
