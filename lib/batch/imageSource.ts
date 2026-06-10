// Uniform lazy handle over batch images, whether picked directly (File
// objects are lazy references — selecting 300 costs nothing) or inside a zip
// (only the compressed buffer is held; each entry is inflated on demand and
// released with the row — ARCHITECTURE "Client-orchestrated batch").

import { unzipSync, type UnzipFileInfo } from "fflate";

export interface ImageSource {
  /** Bare filename (zip paths are stripped) — what the CSV references. */
  name: string;
  getFile: () => Promise<File>;
}

const IMAGE_MIME_BY_EXTENSION: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

function basename(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

function imageMime(name: string): string | null {
  const extension = name.slice(name.lastIndexOf(".") + 1).toLowerCase();
  return IMAGE_MIME_BY_EXTENSION[extension] ?? null;
}

export function isZipFile(file: File): boolean {
  return (
    file.type === "application/zip" ||
    file.type === "application/x-zip-compressed" ||
    file.name.toLowerCase().endsWith(".zip")
  );
}

/** Zip entries to skip: directories, macOS resource forks, hidden files. */
function isJunkEntry(path: string): boolean {
  return (
    path.endsWith("/") ||
    path.startsWith("__MACOSX/") ||
    basename(path).startsWith(".")
  );
}

export class ZipReadError extends Error {
  constructor(zipName: string) {
    super(`Couldn't read "${zipName}" — it may be corrupt or not a zip file.`);
    this.name = "ZipReadError";
  }
}

/**
 * List the image entries of a zip without decompressing any of them.
 * Each entry's `getFile` inflates just that entry when a row needs it.
 */
export async function zipImageSources(zip: File): Promise<ImageSource[]> {
  const data = new Uint8Array(await zip.arrayBuffer());

  // filter() sees every entry's metadata; returning false skips inflation,
  // so this pass only walks the archive directory.
  const entries: UnzipFileInfo[] = [];
  try {
    unzipSync(data, {
      filter: (entry) => {
        entries.push(entry);
        return false;
      },
    });
  } catch {
    throw new ZipReadError(zip.name);
  }

  return entries
    .filter((entry) => !isJunkEntry(entry.name) && imageMime(entry.name) !== null)
    .map((entry) => ({
      name: basename(entry.name),
      getFile: async () => {
        const bytes = unzipSync(data, { filter: (e) => e.name === entry.name })[
          entry.name
        ];
        if (!bytes) throw new ZipReadError(zip.name);
        return new File([bytes], basename(entry.name), {
          type: imageMime(entry.name)!,
        });
      },
    }));
}

/**
 * Build the name → source map from whatever the agent picked: loose image
 * files and/or zips, in any combination. Later picks win on name collisions
 * (re-adding a corrected file replaces the old one). Non-image, non-zip
 * files are reported back, never silently dropped.
 */
export async function collectImageSources(
  files: File[],
): Promise<{ sources: Map<string, ImageSource>; ignored: string[] }> {
  const sources = new Map<string, ImageSource>();
  const ignored: string[] = [];
  for (const file of files) {
    if (isZipFile(file)) {
      for (const source of await zipImageSources(file)) {
        sources.set(source.name, source);
      }
    } else if (imageMime(file.name) !== null) {
      sources.set(file.name, { name: file.name, getFile: async () => file });
    } else {
      ignored.push(file.name);
    }
  }
  return { sources, ignored };
}
