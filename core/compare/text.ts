// Fuzzy text matcher for brand name and class/type (PRD checks 1–2).
// Near-misses (case, punctuation, OCR noise) are flagged ⚠️, never silently
// passed.

import type { ExtractedField, Verdict } from "../types";
import { levenshtein, normalizeLoose, normalizeWhitespace } from "./normalize";
import { absence, verdict } from "./verdicts";

/**
 * Edit-distance budget that still counts as "possibly OCR noise". Zero for
 * very short names — "Ace" vs "Axe" is a different brand, not a misread.
 */
function ocrNoiseBudget(length: number): number {
  if (length < 5) return 0;
  return Math.min(2, Math.max(1, Math.floor(length * 0.15)));
}

export function compareTextField(
  field: "brand_name" | "class_type",
  displayName: string,
  applicationValue: string,
  extracted: ExtractedField,
): Verdict {
  const appValue = normalizeWhitespace(applicationValue);

  if (extracted.value === null) {
    if (absence(extracted) === "absent") {
      return verdict(
        field,
        "mismatch",
        null,
        appValue,
        `No ${displayName} found on the label.`,
      );
    }
    return verdict(
      field,
      "unreadable",
      null,
      appValue,
      `Couldn't read the ${displayName} from the image.`,
    );
  }

  const labelValue = normalizeWhitespace(extracted.value);
  if (labelValue === appValue) {
    return verdict(
      field,
      "match",
      labelValue,
      appValue,
      "Matches the application exactly.",
    );
  }

  if (labelValue.toLowerCase() === appValue.toLowerCase()) {
    return verdict(
      field,
      "probable_match",
      labelValue,
      appValue,
      "Case differs; otherwise identical.",
    );
  }

  const labelLoose = normalizeLoose(labelValue);
  const appLoose = normalizeLoose(appValue);
  if (labelLoose === appLoose) {
    return verdict(
      field,
      "probable_match",
      labelValue,
      appValue,
      "Punctuation or spacing differs; the wording is identical.",
    );
  }

  const distance = levenshtein(labelLoose, appLoose);
  if (distance <= ocrNoiseBudget(Math.max(labelLoose.length, appLoose.length))) {
    return verdict(
      field,
      "probable_match",
      labelValue,
      appValue,
      `Differs by ${distance} character${distance === 1 ? "" : "s"} — possibly a misread of the image. Verify against the label.`,
    );
  }

  return verdict(
    field,
    "mismatch",
    labelValue,
    appValue,
    `Doesn't match — label says "${labelValue}", application says "${appValue}".`,
  );
}
