// Verdict construction helpers + overall derivation.

import type {
  ExtractedField,
  OverallStatus,
  Verdict,
  VerdictStatus,
} from "../types";

export function verdict(
  field: Verdict["field"],
  status: VerdictStatus,
  label_value: string | null,
  application_value: string | null,
  explanation: string,
): Verdict {
  return { field, status, label_value, application_value, explanation };
}

/**
 * Interpret a null reading (see ExtractedField in types.ts): high confidence
 * means the extractor is sure the field is absent; otherwise it was unreadable.
 */
export function absence(field: ExtractedField): "absent" | "unreadable" {
  return field.confidence === "high" ? "absent" : "unreadable";
}

/** Worst field wins: any ❌ → fail; any ⚠️/❓ → needs_review; else pass. */
export function deriveOverall(verdicts: Verdict[]): OverallStatus {
  if (verdicts.some((v) => v.status === "mismatch")) return "fail";
  if (
    verdicts.some(
      (v) => v.status === "probable_match" || v.status === "unreadable",
    )
  ) {
    return "needs_review";
  }
  return "pass";
}
