// Pins the curated demo sets to the generated fixtures: every ID must exist
// in demo.json, every referenced image must be on disk under public/, the
// quick batch must survive pre-flight, and together the quick rows must
// cover every verdict category and overall status — so the demo always has
// something of each kind to show.

import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import expected from "@/fixtures/expected.json";
import { preflight } from "./batch/preflight";
import {
  buildSampleCsv,
  DEMO_CASES,
  demoCase,
  demoImageNames,
  QUICK_BATCH_IDS,
  randomSingleExample,
  SINGLE_EXAMPLE_IDS,
} from "./demo";

const IMAGES_DIR = path.resolve(__dirname, "../public/fixtures/images");
const CURATED = [...new Set([...SINGLE_EXAMPLE_IDS, ...QUICK_BATCH_IDS])];

describe("demo data", () => {
  it("has a manifest entry for the whole fixture batch", () => {
    expect(DEMO_CASES).toHaveLength(55);
  });

  it("every curated ID exists in the manifest", () => {
    for (const id of CURATED) {
      expect(demoCase(id).application.application_id).toBe(id);
    }
  });

  it("every curated case's images exist under public/fixtures/images", () => {
    for (const name of demoImageNames(CURATED)) {
      expect(existsSync(path.join(IMAGES_DIR, name)), name).toBe(true);
    }
  });

  it("the quick batch CSV passes pre-flight against its own images", () => {
    const result = preflight(buildSampleCsv(QUICK_BATCH_IDS), demoImageNames(QUICK_BATCH_IDS));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows).toHaveLength(QUICK_BATCH_IDS.length);
    expect(result.problems).toEqual([]);
    expect(result.orphanImages).toEqual([]);
  });

  it("the quick batch covers every overall status and verdict category", () => {
    const rows = expected.filter((row) =>
      QUICK_BATCH_IDS.includes(row.application_id),
    );
    const overalls = new Set(rows.map((row) => row.overall));
    const statuses = new Set(
      rows.flatMap((row) => Object.values(row.verdicts)),
    );

    expect(overalls).toEqual(new Set(["pass", "needs_review", "fail"]));
    expect(statuses).toEqual(
      new Set(["match", "probable_match", "mismatch", "unreadable"]),
    );
  });

  it("the single-example pool spans all three outcomes", () => {
    const overalls = new Set(
      SINGLE_EXAMPLE_IDS.map((id) => demoCase(id).overall),
    );
    expect(overalls).toEqual(new Set(["pass", "needs_review", "fail"]));
  });

  it("randomSingleExample never repeats the excluded case", () => {
    for (let i = 0; i < 50; i++) {
      const pick = randomSingleExample("APP-001");
      expect(SINGLE_EXAMPLE_IDS).toContain(pick.application.application_id);
      expect(pick.application.application_id).not.toBe("APP-001");
    }
  });
});
