import { describe, expect, it } from "vitest";
import { GOVERNMENT_WARNING } from "../rules/warning";
import { compareWarning } from "./warning";
import { warningField } from "./testHelpers";

describe("compareWarning", () => {
  it("verbatim text with correct bold → match", () => {
    const v = compareWarning(warningField(GOVERNMENT_WARNING));
    expect(v.status).toBe("match");
    expect(v.explanation).toMatch(/verbatim/i);
  });

  it("verbatim text with line breaks (label wrapping) still matches", () => {
    const wrapped = GOVERNMENT_WARNING.replace("(2)", "\n(2)").replace(
      "should not",
      "should\nnot",
    );
    expect(compareWarning(warningField(wrapped)).status).toBe("match");
  });

  it("bold unknown → match with a stated caveat", () => {
    const v = compareWarning(
      warningField(GOVERNMENT_WARNING, { headingBold: null, remainderBold: null }),
    );
    expect(v.status).toBe("match");
    expect(v.explanation).toMatch(/bold.*couldn't/i);
  });

  it("heading reported not bold → probable match, flagged", () => {
    const v = compareWarning(warningField(GOVERNMENT_WARNING, { headingBold: false }));
    expect(v.status).toBe("probable_match");
    expect(v.explanation).toMatch(/bold/i);
  });

  it("remainder reported bold → probable match, flagged", () => {
    const v = compareWarning(warningField(GOVERNMENT_WARNING, { remainderBold: true }));
    expect(v.status).toBe("probable_match");
  });

  it("title-case heading → mismatch (seeded-error case)", () => {
    const titleCase = GOVERNMENT_WARNING.replace(
      "GOVERNMENT WARNING:",
      "Government Warning:",
    );
    const v = compareWarning(warningField(titleCase, { headingAllCaps: false }));
    expect(v.status).toBe("mismatch");
    expect(v.explanation).toMatch(/capital letters/i);
    expect(v.explanation).toContain("Government Warning");
  });

  it("correct heading but body casing differs → probable match", () => {
    const shouted = GOVERNMENT_WARNING.replace(
      "According to the Surgeon General",
      "ACCORDING TO THE SURGEON GENERAL",
    );
    const v = compareWarning(warningField(shouted));
    expect(v.status).toBe("probable_match");
    expect(v.explanation).toMatch(/capitalization/i);
  });

  it("paraphrased text → mismatch", () => {
    const v = compareWarning(
      warningField(
        "GOVERNMENT WARNING: Drinking while pregnant may cause birth defects. Alcohol impairs driving.",
      ),
    );
    expect(v.status).toBe("mismatch");
    expect(v.explanation).toMatch(/verbatim/i);
  });

  it("missing warning → mismatch (seeded-error case)", () => {
    const v = compareWarning(warningField(null, { confidence: "high" }));
    expect(v.status).toBe("mismatch");
    expect(v.explanation).toMatch(/not found/i);
  });

  it("unreadable warning → unreadable", () => {
    const v = compareWarning(warningField(null, { confidence: "low" }));
    expect(v.status).toBe("unreadable");
  });
});
