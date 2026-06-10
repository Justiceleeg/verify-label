// Derives the ideal extraction for a fixture case — what a perfect vision
// extractor would report for its rendered label images. Used by
// cases.test.ts to prove expected verdicts against core/compare, and by the
// generator to emit expected.json.
//
// `extraText` decoy lines are deliberately never read: a perfect extractor
// doesn't mistake ages, batch numbers, or addresses for regulated fields.

import type {
  ExtractedField,
  ExtractedWarning,
  LabelFields,
} from "../core/types";
import {
  resolveSides,
  type FixtureCase,
  type LabelSideSpec,
  type UnreadableField,
} from "./cases";

/** Confidently absent — the field genuinely isn't on any rendered side. */
const ABSENT: ExtractedField = {
  value: null,
  confidence: "high",
  sourceImage: null,
};

/** Printed on some side, but obscured there (blur, smudge, glare, crop,
 * ghost ink, exposure) — the honest extraction is null with low
 * confidence (→ ❓, not "absent"). */
const UNREADABLE: ExtractedField = {
  value: null,
  confidence: "low",
  sourceImage: null,
};

/** First side where the field is printed *and readable* wins; printed but
 * obscured everywhere → unreadable; not printed at all → absent. */
function find(
  sides: LabelSideSpec[],
  pick: (side: LabelSideSpec) => string | undefined,
  key: UnreadableField,
): ExtractedField {
  for (let i = 0; i < sides.length; i++) {
    const value = pick(sides[i]);
    if (value !== undefined && !sides[i].unreadable?.includes(key)) {
      return { value, confidence: "high", sourceImage: i };
    }
  }
  return sides.some((s) => pick(s) !== undefined) ? UNREADABLE : ABSENT;
}

export function idealExtraction(c: FixtureCase): LabelFields {
  const sides = resolveSides(c);

  const warningIndex = sides.findIndex((s) => s.warning !== undefined);
  const government_warning: ExtractedWarning =
    warningIndex === -1
      ? { ...ABSENT, headingBold: null, remainderBold: null }
      : sides[warningIndex].unreadable?.includes("warning")
      ? { ...UNREADABLE, headingBold: null, remainderBold: null }
      : {
          value: sides[warningIndex].warning!.text,
          confidence: "high",
          sourceImage: warningIndex,
          headingBold: sides[warningIndex].warning!.headingBold ?? true,
          remainderBold: sides[warningIndex].warning!.remainderBold ?? false,
        };

  return {
    brand_name: find(sides, (s) => s.brandName, "brandName"),
    class_type: find(sides, (s) => s.classType, "classType"),
    alcohol_content: find(sides, (s) => s.alcohol, "alcohol"),
    proof: find(sides, (s) => s.proof, "proof"),
    net_contents: find(sides, (s) => s.netContents, "netContents"),
    government_warning,
  };
}
