// Shared factories for matcher tests. Not shipped — test-only helpers.

import type {
  ApplicationData,
  Confidence,
  ExtractedField,
  ExtractedWarning,
  LabelFields,
} from "../types";
import { GOVERNMENT_WARNING } from "../rules/warning";

export function field(
  value: string | null,
  confidence: Confidence = "high",
  sourceImage: number | null = 0,
): ExtractedField {
  return { value, confidence, sourceImage: value === null ? null : sourceImage };
}

export function warningField(
  value: string | null,
  overrides: Partial<ExtractedWarning> = {},
): ExtractedWarning {
  return {
    ...field(value, overrides.confidence ?? "high", 1),
    headingAllCaps: value !== null ? value.startsWith("GOVERNMENT WARNING") : null,
    headingBold: true,
    remainderBold: false,
    ...overrides,
  };
}

export function application(
  overrides: Partial<ApplicationData> = {},
): ApplicationData {
  return {
    application_id: "APP-001",
    beverage_type: "spirits",
    brand_name: "Old Tom Distillery",
    class_type: "Kentucky Straight Bourbon Whiskey",
    abv: 45,
    net_contents: "750 mL",
    ...overrides,
  };
}

/** A fully-correct extraction for the default application. */
export function labelFields(overrides: Partial<LabelFields> = {}): LabelFields {
  return {
    brand_name: field("Old Tom Distillery"),
    class_type: field("Kentucky Straight Bourbon Whiskey"),
    alcohol_content: field("Alc. 45% by Vol."),
    proof: field("90 Proof"),
    net_contents: field("750 mL"),
    government_warning: warningField(GOVERNMENT_WARNING),
    ...overrides,
  };
}
