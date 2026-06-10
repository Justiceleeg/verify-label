import { describe, expect, it } from "vitest";
import {
  levenshtein,
  normalizeLoose,
  normalizeWhitespace,
  parseAlcoholStatement,
  parseCustomaryContents,
  parseNetContents,
  parseProof,
} from "./normalize";

describe("normalizeWhitespace", () => {
  it("collapses runs and trims", () => {
    expect(normalizeWhitespace("  GOVERNMENT\n WARNING:\t (1) ")).toBe(
      "GOVERNMENT WARNING: (1)",
    );
  });
});

describe("normalizeLoose", () => {
  it("case-folds and strips punctuation", () => {
    expect(normalizeLoose("STONE'S THROW")).toBe(normalizeLoose("Stone's Throw"));
    expect(normalizeLoose("Old-Tom Distillery")).toBe("old tom distillery");
  });

  it("folds diacritics", () => {
    expect(normalizeLoose("Añejo Tequila")).toBe("anejo tequila");
  });
});

describe("levenshtein", () => {
  it("measures edit distance", () => {
    expect(levenshtein("bourbon", "bourbon")).toBe(0);
    expect(levenshtein("bourbon", "bourb0n")).toBe(1);
    expect(levenshtein("", "abc")).toBe(3);
    expect(levenshtein("whiskey", "vodka")).toBeGreaterThan(2);
  });
});

describe("parseNetContents", () => {
  it("parses mL", () => {
    expect(parseNetContents("750 mL")).toBe(750);
    expect(parseNetContents("750ML")).toBe(750);
    expect(parseNetContents("750 milliliters")).toBe(750);
  });

  it("normalizes L and cL to mL", () => {
    expect(parseNetContents("1.75 L")).toBe(1750);
    expect(parseNetContents("1 Liter")).toBe(1000);
    expect(parseNetContents("75 cl")).toBe(750);
  });

  it("handles thousands separators", () => {
    expect(parseNetContents("1,000 mL")).toBe(1000);
  });

  it("returns null when no metric quantity is present", () => {
    expect(parseNetContents("25.4 FL OZ")).toBeNull();
    expect(parseNetContents("a fifth")).toBeNull();
  });

});

describe("parseCustomaryContents", () => {
  it("parses fl oz", () => {
    expect(parseCustomaryContents("12 FL OZ")).toBeCloseTo(354.88, 1);
    expect(parseCustomaryContents("12 fl. oz.")).toBeCloseTo(354.88, 1);
  });

  it("parses pints, quarts, gallons", () => {
    expect(parseCustomaryContents("1 PINT")).toBeCloseTo(473.18, 1);
    expect(parseCustomaryContents("1 QUART")).toBeCloseTo(946.35, 1);
    expect(parseCustomaryContents("1 GALLON")).toBeCloseTo(3785.41, 1);
  });

  it("parses fractions", () => {
    expect(parseCustomaryContents("1/2 GALLON")).toBeCloseTo(1892.71, 1);
  });

  it("sums compound statements (§7.70(a)(3) forms)", () => {
    expect(parseCustomaryContents("1 PT. 8 FL. OZ.")).toBeCloseTo(709.76, 1);
  });

  it("returns null for metric-only or junk", () => {
    expect(parseCustomaryContents("750 mL")).toBeNull();
    expect(parseCustomaryContents("gibberish")).toBeNull();
  });
});

describe("parseAlcoholStatement", () => {
  it("parses standard single-value forms", () => {
    expect(parseAlcoholStatement("Alc. 45% by Vol.")).toEqual({
      low: 45,
      high: 45,
      formatValid: true,
    });
    expect(parseAlcoholStatement("45% alc/vol")).toEqual({
      low: 45,
      high: 45,
      formatValid: true,
    });
    expect(parseAlcoholStatement("ALCOHOL 13.5% BY VOLUME")).toEqual({
      low: 13.5,
      high: 13.5,
      formatValid: true,
    });
  });

  it('accepts "percent" spelled out (§5.65(b)(2)(i) forms)', () => {
    expect(parseAlcoholStatement("Alcohol 40 percent by volume")).toEqual({
      low: 40,
      high: 40,
      formatValid: true,
    });
    expect(parseAlcoholStatement("Alc. 11 percent to 13 percent by vol.")).toEqual({
      low: 11,
      high: 13,
      formatValid: true,
    });
  });

  it("flags nonstandard formats while still extracting the value", () => {
    expect(parseAlcoholStatement("45% ABV")).toEqual({
      low: 45,
      high: 45,
      formatValid: false,
    });
  });

  it("parses ranges", () => {
    expect(parseAlcoholStatement("Alc. 11% to 13% by Vol.")).toEqual({
      low: 11,
      high: 13,
      formatValid: true,
    });
    expect(parseAlcoholStatement("13.5%–14.5% ALC./VOL.")).toEqual({
      low: 13.5,
      high: 14.5,
      formatValid: true,
    });
    expect(parseAlcoholStatement("ALC. 12-14% BY VOL.")).toEqual({
      low: 12,
      high: 14,
      formatValid: true,
    });
  });

  it("returns null when no percentage is present", () => {
    expect(parseAlcoholStatement("90 Proof")).toBeNull();
  });
});

describe("parseProof", () => {
  it("parses proof statements", () => {
    expect(parseProof("90 Proof")).toBe(90);
    expect(parseProof("90 PROOF")).toBe(90);
    expect(parseProof("100.5 proof")).toBe(100.5);
  });

  it("returns null when absent", () => {
    expect(parseProof("Alc. 45% by Vol.")).toBeNull();
  });
});
