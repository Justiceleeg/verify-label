// Validates the model's tool input and maps it (snake_case on the wire) to
// LabelFields. The schema is enforced server-side via strict tool use, but
// this parser is the last line of defense — recorded-response tests and any
// non-strict implementation go through it too.

import type {
  Confidence,
  ExtractedField,
  ExtractedWarning,
  LabelFields,
} from "../types";
import { ExtractionError } from "./types";

const CONFIDENCES: readonly Confidence[] = ["high", "medium", "low"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseField(raw: unknown, path: string): ExtractedField {
  if (!isRecord(raw)) {
    throw new ExtractionError(`Extraction response: "${path}" is not an object.`);
  }
  const { value, confidence, source_image } = raw;
  if (value !== null && typeof value !== "string") {
    throw new ExtractionError(
      `Extraction response: "${path}.value" must be a string or null.`,
    );
  }
  if (!CONFIDENCES.includes(confidence as Confidence)) {
    throw new ExtractionError(
      `Extraction response: "${path}.confidence" must be one of ${CONFIDENCES.join(", ")}.`,
    );
  }
  if (source_image !== null && !Number.isInteger(source_image)) {
    throw new ExtractionError(
      `Extraction response: "${path}.source_image" must be an integer or null.`,
    );
  }
  return {
    value,
    confidence: confidence as Confidence,
    sourceImage: value === null ? null : (source_image as number | null),
  };
}

function parseFlag(raw: unknown, path: string): boolean | null {
  if (raw !== null && typeof raw !== "boolean") {
    throw new ExtractionError(
      `Extraction response: "${path}" must be a boolean or null.`,
    );
  }
  return raw;
}

function parseWarning(raw: unknown): ExtractedWarning {
  const base = parseField(raw, "government_warning");
  const record = raw as Record<string, unknown>;
  const warning: ExtractedWarning = {
    ...base,
    headingBold: parseFlag(record.heading_bold, "government_warning.heading_bold"),
    remainderBold: parseFlag(record.remainder_bold, "government_warning.remainder_bold"),
  };
  // Formatting observations are meaningless without a reading.
  if (warning.value === null) {
    return { ...warning, headingBold: null, remainderBold: null };
  }
  return warning;
}

export function parseLabelFields(input: unknown): LabelFields {
  if (!isRecord(input)) {
    throw new ExtractionError("Extraction response is not an object.");
  }
  return {
    brand_name: parseField(input.brand_name, "brand_name"),
    class_type: parseField(input.class_type, "class_type"),
    alcohol_content: parseField(input.alcohol_content, "alcohol_content"),
    proof: parseField(input.proof, "proof"),
    net_contents: parseField(input.net_contents, "net_contents"),
    government_warning: parseWarning(input.government_warning),
  };
}
