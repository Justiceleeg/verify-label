// Proves every fixture case's declared expectations against core/compare,
// using the ideal extraction of its label spec. This pins the shipped
// fixtures (images, CSV, expected.json) to the engine's actual behavior.

import { describe, expect, it } from "vitest";
import { compare } from "../core/compare";
import { FIXTURE_CASES, imageFiles, resolveSides } from "./cases";
import { idealExtraction } from "./extraction";

describe("fixture batch", () => {
  it("has unique application ids and resolvable image references", () => {
    const ids = FIXTURE_CASES.map((c) => c.application.application_id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of FIXTURE_CASES) {
      expect(resolveSides(c).length).toBeGreaterThanOrEqual(1);
      expect(resolveSides(c).length).toBeLessThanOrEqual(2);
      expect(imageFiles(c).length).toBe(resolveSides(c).length);
    }
  });

  it("covers all four verdict categories and all three overall statuses", () => {
    const statuses = new Set(
      FIXTURE_CASES.flatMap((c) => Object.values(c.expected.verdicts)),
    );
    for (const s of ["probable_match", "mismatch", "unreadable"] as const) {
      expect(statuses, `no case seeds a ${s}`).toContain(s);
    }
    const overalls = new Set(FIXTURE_CASES.map((c) => c.expected.overall));
    expect(overalls).toEqual(new Set(["pass", "needs_review", "fail"]));
  });

  for (const c of FIXTURE_CASES) {
    it(`${c.application.application_id} — ${c.note}`, () => {
      const result = compare(c.application, idealExtraction(c));

      for (const v of result.verdicts) {
        const want = c.expected.verdicts[v.field] ?? "match";
        expect(v.status, `${v.field}: ${v.explanation}`).toBe(want);
      }
      // Every declared deviation refers to a verdict the engine produced.
      for (const field of Object.keys(c.expected.verdicts)) {
        expect(
          result.verdicts.some((v) => v.field === field),
          `expected.verdicts names "${field}" but no such verdict was produced`,
        ).toBe(true);
      }
      expect(result.overall).toBe(c.expected.overall);
    });
  }
});
