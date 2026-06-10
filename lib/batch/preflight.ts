// Batch pre-flight: parse the applications CSV and validate everything that
// can be checked without an API call (PRD "Batch processing" step 1) —
// columns, per-row field values (same rules as the API, via core's
// parseApplication), image references, and orphan images. The agent sees the
// full damage report up front instead of burning API calls on broken rows.

import Papa from "papaparse";
import { parseApplication } from "@/core/application";
import type { ApplicationData } from "@/core/types";

export const REQUIRED_COLUMNS = [
  "application_id",
  "beverage_type",
  "brand_name",
  "class_type",
  "abv",
  "net_contents",
  "image_files",
] as const;

/** Mirrors the API's 2-image cap (front + back). */
export const MAX_IMAGES_PER_ROW = 2;

/** One runnable CSV row: validated application data + its image filenames. */
export interface BatchRowInput {
  /** CSV line number as shown in a spreadsheet (header = line 1). */
  line: number;
  application: ApplicationData;
  /** Image filenames in label order — front first, back second. */
  imageNames: string[];
}

/** A row that can't run, with every reason why. */
export interface RowProblem {
  line: number;
  /** Raw application_id cell (may be blank) — for display only. */
  applicationId: string;
  messages: string[];
}

export type PreflightResult =
  /** The file itself is unusable — nothing row-level to report. */
  | { ok: false; fileError: string }
  | {
      ok: true;
      rows: BatchRowInput[];
      problems: RowProblem[];
      /** Provided images no row references. Warning, never blocking. */
      orphanImages: string[];
    };

/**
 * Validate a batch CSV against the set of available image filenames.
 * Pure and synchronous — no File/DOM types — so it's unit-testable and the
 * UI can re-run it instantly when the agent swaps the CSV or adds images.
 */
export function preflight(
  csvText: string,
  availableImages: Iterable<string>,
): PreflightResult {
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
  });

  const fields = parsed.meta.fields ?? [];
  const missingColumns = REQUIRED_COLUMNS.filter((c) => !fields.includes(c));
  if (missingColumns.length > 0) {
    return {
      ok: false,
      fileError:
        `The CSV is missing required column${missingColumns.length === 1 ? "" : "s"}: ` +
        `${missingColumns.join(", ")}. Expected columns: ${REQUIRED_COLUMNS.join(", ")}.`,
    };
  }
  if (parsed.data.length === 0) {
    return { ok: false, fileError: "The CSV has a header but no application rows." };
  }

  const images = new Set(availableImages);
  const imagesLowercase = new Map<string, string>();
  for (const name of images) imagesLowercase.set(name.toLowerCase(), name);

  const rows: BatchRowInput[] = [];
  const problems: RowProblem[] = [];
  const referenced = new Set<string>();

  parsed.data.forEach((raw, index) => {
    const line = index + 2; // header is line 1
    const messages: string[] = [];

    const application = parseApplication(raw);
    if (!application.ok) messages.push(...application.errors);

    const imageNames = (raw.image_files ?? "")
      .split(";")
      .map((name) => name.trim())
      .filter((name) => name !== "");
    if (imageNames.length === 0) {
      messages.push('"image_files" must list at least one image filename.');
    } else if (imageNames.length > MAX_IMAGES_PER_ROW) {
      messages.push(
        `"image_files" lists ${imageNames.length} images — the limit is ` +
          `${MAX_IMAGES_PER_ROW} (front and back).`,
      );
    }
    for (const name of imageNames) {
      referenced.add(name);
      if (images.has(name)) continue;
      const caseMatch = imagesLowercase.get(name.toLowerCase());
      messages.push(
        caseMatch
          ? `Image "${name}" wasn't provided — did you mean "${caseMatch}"? ` +
              "(filenames are case-sensitive)"
          : `Image "${name}" wasn't provided. Add it to the image selection ` +
              "or fix the filename in the CSV.",
      );
    }

    if (application.ok && messages.length === 0) {
      rows.push({ line, application: application.data, imageNames });
    } else {
      problems.push({ line, applicationId: raw.application_id?.trim() ?? "", messages });
    }
  });

  const orphanImages = [...images].filter((name) => !referenced.has(name)).sort();
  return { ok: true, rows, problems, orphanImages };
}
