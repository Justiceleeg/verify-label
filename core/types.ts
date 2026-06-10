// Shared types used end-to-end: CSV/form input, extraction output, verdicts.
// See docs/ARCHITECTURE.md ("Repo layout", "API").

export type BeverageType = "spirits" | "wine" | "malt";

/** One application row — from the single-label form or a batch CSV row. */
export interface ApplicationData {
  application_id: string;
  beverage_type: BeverageType;
  brand_name: string;
  class_type: string;
  /** ABV as a percentage, e.g. 45 for 45% alc/vol. */
  abv: number;
  /** As written on the application, e.g. "750 mL". */
  net_contents: string;
}

export type Confidence = "high" | "medium" | "low";

/**
 * A single field as read off the label by the extractor.
 * `value: null` means the extractor could not read it (→ ❓ verdict).
 */
export interface ExtractedField {
  value: string | null;
  confidence: Confidence;
  /** Index into the submitted images this field was read from. */
  sourceImage: number | null;
}

/** Government warning needs formatting observations beyond the raw text. */
export interface ExtractedWarning extends ExtractedField {
  /** Whether "GOVERNMENT WARNING" appears in all caps. */
  headingAllCaps: boolean | null;
  /** Bold detection is best-effort from photos; null = couldn't tell. */
  headingBold: boolean | null;
  remainderBold: boolean | null;
}

/** Everything the vision extractor reports. Perception only — no judgments. */
export interface LabelFields {
  brand_name: ExtractedField;
  class_type: ExtractedField;
  /** Raw alcohol statement as printed, e.g. "Alc. 45% by Vol." */
  alcohol_content: ExtractedField;
  /** Proof statement if printed (spirits), e.g. "90 Proof". */
  proof: ExtractedField;
  net_contents: ExtractedField;
  government_warning: ExtractedWarning;
}

export type VerdictStatus =
  | "match" // ✅
  | "probable_match" // ⚠️ needs human review
  | "mismatch" // ❌ wrong or missing
  | "unreadable"; // ❓ could not be read from the image

export interface Verdict {
  field: keyof LabelFields | "same_field_of_vision";
  status: VerdictStatus;
  label_value: string | null;
  application_value: string | null;
  explanation: string;
}

/** Derived from verdicts — worst field wins. Never hides field detail. */
export type OverallStatus = "pass" | "needs_review" | "fail";

export interface VerificationResult {
  extracted: LabelFields;
  verdicts: Verdict[];
  overall: OverallStatus;
}
