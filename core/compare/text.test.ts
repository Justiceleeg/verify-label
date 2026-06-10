import { describe, expect, it } from "vitest";
import { compareTextField } from "./text";
import { field } from "./testHelpers";

const compareBrand = (app: string, label: string | null, confidence?: "high" | "medium" | "low") =>
  compareTextField("brand_name", "brand name", app, field(label, confidence));

describe("compareTextField", () => {
  it("exact match → match", () => {
    const v = compareBrand("Old Tom Distillery", "Old Tom Distillery");
    expect(v.status).toBe("match");
    expect(v.field).toBe("brand_name");
  });

  it("whitespace differences alone still match", () => {
    expect(compareBrand("Old Tom Distillery", "Old  Tom\nDistillery").status).toBe("match");
  });

  it("case difference → probable match, never silently passed", () => {
    const v = compareBrand("Stone's Throw", "STONE'S THROW");
    expect(v.status).toBe("probable_match");
    expect(v.explanation).toMatch(/case/i);
  });

  it("punctuation difference → probable match", () => {
    const v = compareBrand("Stones Throw", "Stone's Throw");
    expect(v.status).toBe("probable_match");
    expect(v.explanation).toMatch(/punctuation|spacing/i);
  });

  it("one-character OCR noise → probable match", () => {
    const v = compareBrand("Old Tom Distillery", "Old Tom Distillary");
    expect(v.status).toBe("probable_match");
  });

  it("different brand → mismatch (seeded-error case)", () => {
    const v = compareBrand("Old Tom Distillery", "Silver Creek Vodka");
    expect(v.status).toBe("mismatch");
    expect(v.explanation).toContain("Silver Creek Vodka");
  });

  it("short names don't fuzzy-match each other", () => {
    expect(compareBrand("Ace", "Axe").status).toBe("mismatch");
  });

  it("confidently absent → mismatch", () => {
    expect(compareBrand("Old Tom Distillery", null, "high").status).toBe("mismatch");
  });

  it("unreadable → unreadable", () => {
    expect(compareBrand("Old Tom Distillery", null, "low").status).toBe("unreadable");
  });

  it("works for class/type too", () => {
    const v = compareTextField(
      "class_type",
      "class/type",
      "Kentucky Straight Bourbon Whiskey",
      field("KENTUCKY STRAIGHT BOURBON WHISKEY"),
    );
    expect(v.field).toBe("class_type");
    expect(v.status).toBe("probable_match");
  });
});
