// Demo loaders for the shipped sample data. The fixture images are served
// from public/fixtures/images/, so the app can fetch them and wrap them in
// File objects — demo runs flow through the exact same pipeline (downscale,
// pre-flight, /api/verify) as real uploads.
//
// fixtures/demo.json is generated from fixtures/cases.ts by
// `pnpm fixtures:generate`; demo.test.ts pins the curated ID lists below to
// it so they can't drift from the actual fixtures.

import demoJson from "@/fixtures/demo.json";
import type { ApplicationData, OverallStatus } from "@/core/types";

export interface DemoCase {
  application: ApplicationData;
  image_files: string[];
  overall: OverallStatus;
  /** One-line story of what this case demonstrates, from fixtures/cases.ts. */
  note: string;
}

export const DEMO_CASES = demoJson as DemoCase[];

/**
 * Pool for the single-label "Try an example" button: self-narrating cases —
 * each has one clear story and spans all three outcomes, flat labels and
 * photo-realism shots alike.
 */
export const SINGLE_EXAMPLE_IDS = [
  "APP-001", // clean pass, the PRD's success-criteria sample
  "APP-002", // wrong ABV
  "APP-003", // title-case government warning
  "APP-005", // mismatched brand name
  "APP-007", // all-caps brand → probable match, flagged
  "APP-008", // proof contradicts ABV
  "APP-015", // field-of-vision split (§5.63)
  "APP-017", // blurred alcohol statement → unreadable, never a guess
  "APP-021", // warning verbatim but heading not bold
  "APP-024", // lens smudge over the alcohol statement → unreadable
  "APP-026", // wrong net contents under heavy photo effects
  "APP-031", // decoy small print everywhere, still a clean pass
  "APP-045", // handheld wine shot, ordinary pass
  "APP-052", // warning drops the single word "operate"
  "APP-054", // 350 mL printed against a 375 mL application
];

/**
 * The quick sample batch: every verdict category and overall status, the
 * PRD's seeded errors, a wrong-image row, and a few realism shots — small
 * enough to run in seconds during a demo.
 */
export const QUICK_BATCH_IDS = [
  "APP-001", // pass — success-criteria sample
  "APP-002", // fail — wrong ABV
  "APP-003", // fail — title-case warning
  "APP-004", // fail — missing warning
  "APP-005", // fail — mismatched brand
  "APP-006", // fail — wrong net contents
  "APP-007", // review — all-caps brand fuzzy match
  "APP-008", // fail — proof/ABV contradiction
  "APP-011", // pass — wine legally omitting alcohol content
  "APP-012", // pass — single-image malt can
  "APP-015", // review — field-of-vision split
  "APP-019", // fail — wrong image attached
  "APP-021", // review — non-bold warning heading
  "APP-022", // pass — curved bottle with glare, legible
  "APP-024", // review — unreadable alcohol statement (lens smudge)
  "APP-031", // pass — decoy small print
  "APP-044", // pass — dual-unit net contents on a liter bottle
  "APP-052", // fail — warning missing one word
];

const byId = new Map(DEMO_CASES.map((c) => [c.application.application_id, c]));

export function demoCase(id: string): DemoCase {
  const found = byId.get(id);
  if (!found) throw new Error(`Unknown demo case "${id}"`);
  return found;
}

/** Random pick from the single-example pool, never repeating the last one. */
export function randomSingleExample(excludeId?: string): DemoCase {
  const pool = SINGLE_EXAMPLE_IDS.filter((id) => id !== excludeId);
  return demoCase(pool[Math.floor(Math.random() * pool.length)]);
}

export function demoImageUrl(name: string): string {
  return `/fixtures/images/${encodeURIComponent(name)}`;
}

export async function fetchDemoImage(name: string): Promise<File> {
  const response = await fetch(demoImageUrl(name));
  if (!response.ok) {
    throw new Error(`Couldn't load the sample image "${name}" (${response.status}).`);
  }
  const blob = await response.blob();
  return new File([blob], name, { type: blob.type || "image/png" });
}

/**
 * Fetch many sample images with bounded concurrency, reporting progress as
 * each one lands. Order of the result matches `names`.
 */
export async function fetchDemoImages(
  names: string[],
  onProgress?: (done: number, total: number) => void,
): Promise<File[]> {
  const files = new Array<File>(names.length);
  let next = 0;
  let done = 0;
  async function worker() {
    while (next < names.length) {
      const index = next++;
      files[index] = await fetchDemoImage(names[index]);
      onProgress?.(++done, names.length);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(6, names.length) }, () => worker()),
  );
  return files;
}

/** Deduped image filenames referenced by the given rows. */
export function demoImageNames(ids: string[]): string[] {
  return [...new Set(ids.flatMap((id) => demoCase(id).image_files))];
}

function csvField(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Build a sample applications CSV for the given rows — same shape as the
 * shipped fixtures/applications.csv. */
export function buildSampleCsv(ids: string[]): string {
  const header =
    "application_id,beverage_type,brand_name,class_type,abv,net_contents,image_files";
  const rows = ids.map((id) => {
    const { application, image_files } = demoCase(id);
    return [
      application.application_id,
      application.beverage_type,
      application.brand_name,
      application.class_type,
      application.abv,
      application.net_contents,
      image_files.join(";"),
    ]
      .map(csvField)
      .join(",");
  });
  return [header, ...rows].join("\n") + "\n";
}
