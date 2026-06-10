import { describe, expect, it } from "vitest";
import { parseLabelFields } from "./parse";
import { ExtractionError } from "./types";

/** A complete, valid wire payload (what the model's tool input looks like). */
function validInput() {
  return {
    brand_name: { value: "Old Tom Distillery", confidence: "high", source_image: 0 },
    class_type: {
      value: "Kentucky Straight Bourbon Whiskey",
      confidence: "high",
      source_image: 0,
    },
    alcohol_content: { value: "Alc. 45% by Vol.", confidence: "high", source_image: 0 },
    proof: { value: "90 Proof", confidence: "medium", source_image: 0 },
    net_contents: { value: "750 mL", confidence: "high", source_image: 0 },
    government_warning: {
      value: "GOVERNMENT WARNING: ...",
      confidence: "high",
      source_image: 1,
      heading_bold: true,
      remainder_bold: false,
    },
  };
}

describe("parseLabelFields", () => {
  it("maps a valid payload to LabelFields (snake_case → camelCase)", () => {
    const fields = parseLabelFields(validInput());
    expect(fields.brand_name).toEqual({
      value: "Old Tom Distillery",
      confidence: "high",
      sourceImage: 0,
    });
    expect(fields.proof.confidence).toBe("medium");
    expect(fields.government_warning).toEqual({
      value: "GOVERNMENT WARNING: ...",
      confidence: "high",
      sourceImage: 1,
      headingBold: true,
      remainderBold: false,
    });
  });

  it("accepts a confidently-absent field (null value, high confidence)", () => {
    const input = validInput();
    input.proof = { value: null, confidence: "high", source_image: null } as never;
    const fields = parseLabelFields(input);
    expect(fields.proof).toEqual({ value: null, confidence: "high", sourceImage: null });
  });

  it("forces sourceImage to null when the value is null", () => {
    const input = validInput();
    input.proof = { value: null, confidence: "low", source_image: 0 } as never;
    expect(parseLabelFields(input).proof.sourceImage).toBeNull();
  });

  it("forces warning formatting flags to null when the warning is unread", () => {
    const input = validInput();
    input.government_warning = {
      value: null,
      confidence: "low",
      source_image: null,
      heading_bold: true,
      remainder_bold: false,
    } as never;
    const warning = parseLabelFields(input).government_warning;
    expect(warning.headingBold).toBeNull();
    expect(warning.remainderBold).toBeNull();
  });

  it("rejects a non-object payload", () => {
    expect(() => parseLabelFields("nope")).toThrow(ExtractionError);
    expect(() => parseLabelFields(null)).toThrow(ExtractionError);
  });

  it("rejects an invalid confidence", () => {
    const input = validInput();
    input.brand_name.confidence = "certain" as never;
    expect(() => parseLabelFields(input)).toThrow(/brand_name.*confidence/);
  });

  it("rejects a non-string value", () => {
    const input = validInput();
    input.net_contents.value = 750 as never;
    expect(() => parseLabelFields(input)).toThrow(/net_contents.*value/);
  });

  it("rejects a missing field", () => {
    const input = validInput();
    delete (input as Record<string, unknown>).class_type;
    expect(() => parseLabelFields(input)).toThrow(/class_type/);
  });

  it("rejects a non-boolean formatting flag", () => {
    const input = validInput();
    input.government_warning.heading_bold = "yes" as never;
    expect(() => parseLabelFields(input)).toThrow(/heading_bold/);
  });
});
