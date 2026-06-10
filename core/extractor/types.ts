// The extractor seam (see docs/ARCHITECTURE.md "Extractor implementations"):
// one function from label images to LabelFields. Implementations are
// interchangeable behind config — Claude vision ships in the prototype.

import type { BeverageType, LabelFields } from "../types";

/** One label image, ready to send: base64 data + its MIME type. */
export interface LabelImage {
  /** Base64-encoded image bytes (no data: prefix). */
  data: string;
  mediaType: "image/png" | "image/jpeg" | "image/webp" | "image/gif";
}

/**
 * Perception only: reports what the label says, never a compliance judgment.
 * Index order of `images` is meaningful — `sourceImage` in the result refers
 * back into it (0 = front, 1 = back by convention).
 */
export interface Extractor {
  extract(images: LabelImage[], beverageType: BeverageType): Promise<LabelFields>;
}

/** The extraction failed in a way a retry might fix (bad response shape,
 * upstream error). Carries an actionable message for the affected row. */
export class ExtractionError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "ExtractionError";
  }
}
