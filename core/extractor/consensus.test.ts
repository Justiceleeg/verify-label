import { describe, expect, it } from "vitest";
import type { ExtractedField, ExtractedWarning } from "../types";
import { createConsensusExtractor, voteField, voteFlag, voteWarning } from "./consensus";
import type { Extractor, LabelImage } from "./types";

const f = (
  value: string | null,
  confidence: ExtractedField["confidence"] = "high",
  sourceImage: number | null = value === null ? null : 0,
): ExtractedField => ({ value, confidence, sourceImage });

describe("voteField", () => {
  it("majority value wins; whitespace jitter doesn't split votes", () => {
    const out = voteField([f("750 mL"), f("750  mL"), f("700 mL")]);
    expect(out.value).toMatch(/750\s+mL/);
  });

  it("carries the best-confidence winner's raw reading", () => {
    const out = voteField([f("Alc. 45% by Vol.", "medium"), f("Alc. 45% by Vol.", "high"), f(null, "low")]);
    expect(out).toEqual({ value: "Alc. 45% by Vol.", confidence: "high", sourceImage: 0 });
  });

  it("three-way disagreement → null/low (human review, never a coin flip)", () => {
    const out = voteField([f("Kestrel"), f("Kentsled"), f(null, "low")]);
    expect(out).toEqual({ value: null, confidence: "low", sourceImage: null });
  });

  it("null majority votes absent-vs-unreadable among the null readers", () => {
    expect(voteField([f(null, "high"), f(null, "high"), f(null, "low")]).confidence).toBe("high");
    expect(voteField([f(null, "high"), f(null, "low"), f(null, "low")]).confidence).toBe("low");
    // 2 nulls beat 1 value, but split high/low ties to low (conservative).
    expect(voteField([f(null, "high"), f(null, "low"), f("90 Proof")])).toEqual({
      value: null,
      confidence: "low",
      sourceImage: null,
    });
  });
});

describe("voteFlag", () => {
  it("majority of cast votes; nulls abstain; tie → null", () => {
    expect(voteFlag([true, true, false])).toBe(true);
    expect(voteFlag([false, false, null])).toBe(false);
    expect(voteFlag([true, false, null])).toBeNull();
    expect(voteFlag([null, null, null])).toBeNull();
  });
});

describe("voteWarning", () => {
  const w = (
    value: string | null,
    headingBold: boolean | null,
    confidence: ExtractedField["confidence"] = "high",
  ): ExtractedWarning => ({
    value,
    confidence,
    sourceImage: value === null ? null : 1,
    headingAllCaps: value === null ? null : true,
    headingBold,
    remainderBold: value === null ? null : false,
  });

  it("votes flags only among readings that agree with the winning text", () => {
    const out = voteWarning([w("GOVERNMENT WARNING: …", false), w("GOVERNMENT WARNING: …", false), w("Government Warning: …", true)]);
    expect(out.value).toBe("GOVERNMENT WARNING: …");
    expect(out.headingBold).toBe(false);
  });

  it("null warning carries null flags", () => {
    const out = voteWarning([w(null, null, "low"), w(null, null, "low"), w("GOVERNMENT WARNING: …", true)]);
    expect(out.value).toBeNull();
    expect(out.headingBold).toBeNull();
  });
});

describe("createConsensusExtractor", () => {
  const IMG: LabelImage[] = [{ data: "eA==", mediaType: "image/png" }];

  function extractorReturning(values: (string | Error)[]): Extractor {
    let i = 0;
    return {
      async extract() {
        const v = values[i++ % values.length];
        if (v instanceof Error) throw v;
        return {
          brand_name: f(v),
          class_type: f("Vodka"),
          alcohol_content: f("Alc. 40% by Vol."),
          proof: f(null),
          net_contents: f("750 mL"),
          government_warning: {
            ...f("GOVERNMENT WARNING: …"),
            headingAllCaps: true,
            headingBold: true,
            remainderBold: false,
          },
        };
      },
    };
  }

  it("returns the majority reading across votes", async () => {
    const consensus = createConsensusExtractor(extractorReturning(["A", "A", "B"]), 3);
    const out = await consensus.extract(IMG, "spirits");
    expect(out.brand_name.value).toBe("A");
  });

  it("tolerates a minority of failed votes", async () => {
    const consensus = createConsensusExtractor(
      extractorReturning(["A", new Error("boom"), "A"]),
      3,
    );
    const out = await consensus.extract(IMG, "spirits");
    expect(out.brand_name.value).toBe("A");
  });

  it("propagates the failure when a majority of votes die", async () => {
    const consensus = createConsensusExtractor(
      extractorReturning([new Error("boom"), new Error("boom"), "A"]),
      3,
    );
    await expect(consensus.extract(IMG, "spirits")).rejects.toThrow("boom");
  });

  it("votes=1 is the base extractor, unwrapped", () => {
    const base = extractorReturning(["A"]);
    expect(createConsensusExtractor(base, 1)).toBe(base);
  });
});
