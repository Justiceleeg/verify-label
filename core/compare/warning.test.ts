import { describe, expect, it } from "vitest";
import { GOVERNMENT_WARNING } from "../rules/warning";
import { compareWarning, explainWarningDivergence } from "./warning";
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
    const v = compareWarning(warningField(titleCase));
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

  it("paraphrased text → mismatch, explanation pinpoints a word", () => {
    const v = compareWarning(
      warningField(
        "GOVERNMENT WARNING: Drinking while pregnant may cause birth defects. Alcohol impairs driving.",
      ),
    );
    expect(v.status).toBe("mismatch");
    expect(v.explanation).toMatch(/first difference is at word \d+/i);
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

describe("explainWarningDivergence", () => {
  it("pinpoints a single-word substitution mid-text", () => {
    const explanation = explainWarningDivergence(
      GOVERNMENT_WARNING.replace("defects", "effects"),
    );
    expect(explanation).toContain("word 23");
    expect(explanation).toContain('label says "effects."');
    expect(explanation).toContain('required text says "defects."');
  });

  it("pinpoints a divergence at word 1", () => {
    const explanation = explainWarningDivergence(
      GOVERNMENT_WARNING.replace("GOVERNMENT WARNING:", "WARNING:"),
    );
    expect(explanation).toContain("word 1");
    expect(explanation).toContain('label says "WARNING:"');
    expect(explanation).toContain('required text says "GOVERNMENT"');
  });

  it("points at the right spot when a word is dropped", () => {
    const explanation = explainWarningDivergence(
      GOVERNMENT_WARNING.replace("should not drink", "should drink"),
    );
    expect(explanation).toContain("word 11");
    expect(explanation).toContain('label says "drink"');
    expect(explanation).toContain('required text says "not"');
  });

  it("reports a truncated warning with the missing text", () => {
    const firstSentenceOnly = GOVERNMENT_WARNING.slice(
      0,
      GOVERNMENT_WARNING.indexOf(" (2)"),
    );
    const explanation = explainWarningDivergence(firstSentenceOnly);
    expect(explanation).toMatch(/stops early/i);
    expect(explanation).toContain("word 24");
    expect(explanation).toContain("(2) Consumption of alcoholic beverages impairs");
    expect(explanation).toContain("…");
  });

  it("reports extra text appended after the required statement", () => {
    const explanation = explainWarningDivergence(
      `${GOVERNMENT_WARNING} Drink responsibly.`,
    );
    expect(explanation).toMatch(/adds extra text/i);
    expect(explanation).toContain("Drink responsibly.");
  });

  it("flags a punctuation-only token difference as a real divergence", () => {
    const explanation = explainWarningDivergence(
      GOVERNMENT_WARNING.replace("machinery, and", "machinery and"),
    );
    expect(explanation).toContain("word 38");
    expect(explanation).toContain('label says "machinery"');
    expect(explanation).toContain('required text says "machinery,"');
  });

  it("every divergence explanation keeps the regulatory reminder", () => {
    for (const mutated of [
      GOVERNMENT_WARNING.replace("defects", "effects"),
      GOVERNMENT_WARNING.slice(0, GOVERNMENT_WARNING.indexOf(" (2)")),
      `${GOVERNMENT_WARNING} Drink responsibly.`,
    ]) {
      expect(explainWarningDivergence(mutated)).toContain(
        "fixed by regulation — no paraphrasing",
      );
    }
  });
});
