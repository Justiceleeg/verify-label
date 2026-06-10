// Regenerates everything under fixtures/ that ships in the repo:
//   images/*.png        rendered label images (Playwright screenshot)
//   applications.csv    the sample batch CSV
//   expected.json       expected verdicts per row (via core/compare on the
//                       ideal extraction — cases.test.ts proves these equal
//                       the declared expectations)
//   preflight/*.csv     deliberately invalid CSVs for pre-flight validation
//
// Run with: pnpm fixtures:generate

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { compare } from "../../core/compare";
import { FIXTURE_CASES, imageFiles } from "../cases";
import { idealExtraction } from "../extraction";
import {
  renderCurvedLabelHtml,
  renderCurvedSceneHtml,
  renderSideHtml,
} from "./html";

const FIXTURES_DIR = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");

const CSV_HEADER =
  "application_id,beverage_type,brand_name,class_type,abv,net_contents,image_files";

function csvField(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csvRow(values: Array<string | number>): string {
  return values.map(csvField).join(",");
}

async function renderImages(): Promise<number> {
  const imagesDir = path.join(FIXTURES_DIR, "images");
  await mkdir(imagesDir, { recursive: true });

  // Uses the system Chrome; saves the Playwright-managed Chromium download.
  const browser = await chromium.launch({ channel: "chrome" });
  // Sized to fit the effects scene (820×1020 + body padding); flat labels
  // are element screenshots, so the extra viewport doesn't affect them.
  const page = await browser.newPage({
    viewport: { width: 900, height: 1100 },
    deviceScaleFactor: 2,
  });

  let count = 0;
  for (const c of FIXTURE_CASES) {
    if (!c.sides) continue; // imagesFrom rows reuse another case's files
    const files = imageFiles(c);
    for (let i = 0; i < c.sides.length; i++) {
      const side = c.sides[i];
      const beverage = c.application.beverage_type;
      if (side.effects?.curvature) {
        // Two passes: capture the label flat, then warp those exact pixels
        // onto a cylinder (see html.ts).
        await page.setContent(renderCurvedLabelHtml(side, c.style, beverage));
        const flat = await page.locator(".shot").screenshot();
        await page.setContent(
          renderCurvedSceneHtml(side, c.style, flat.toString("base64")),
        );
        await page.waitForFunction(
          'document.querySelector(".warp")?.dataset.warped === "1"',
        );
      } else {
        await page.setContent(renderSideHtml(side, c.style, beverage));
      }
      await page
        .locator(".shot")
        .screenshot({ path: path.join(imagesDir, files[i]) });
      count++;
    }
  }

  await browser.close();
  return count;
}

async function writeCsv(): Promise<void> {
  const rows = FIXTURE_CASES.map((c) =>
    csvRow([
      c.application.application_id,
      c.application.beverage_type,
      c.application.brand_name,
      c.application.class_type,
      c.application.abv,
      c.application.net_contents,
      imageFiles(c).join(";"),
    ]),
  );
  await writeFile(
    path.join(FIXTURES_DIR, "applications.csv"),
    [CSV_HEADER, ...rows].join("\n") + "\n",
  );
}

async function writeExpected(): Promise<void> {
  const expected = FIXTURE_CASES.map((c) => {
    const result = compare(c.application, idealExtraction(c));
    return {
      application_id: c.application.application_id,
      note: c.note,
      image_files: imageFiles(c),
      overall: result.overall,
      verdicts: Object.fromEntries(
        result.verdicts.map((v) => [v.field, v.status]),
      ),
    };
  });
  await writeFile(
    path.join(FIXTURES_DIR, "expected.json"),
    JSON.stringify(expected, null, 2) + "\n",
  );
}

/** CSVs that must fail pre-flight validation, for testing the batch UI. */
async function writePreflight(): Promise<void> {
  const dir = path.join(FIXTURES_DIR, "preflight");
  await mkdir(dir, { recursive: true });

  const valid = csvRow([
    "APP-001", "spirits", "Old Tom Distillery",
    "Kentucky Straight Bourbon Whiskey", 45, "750 mL",
    "app-001-front.png;app-001-back.png",
  ]);
  await writeFile(
    path.join(dir, "missing-image.csv"),
    [
      CSV_HEADER,
      valid,
      csvRow([
        "APP-901", "spirits", "Phantom Ridge", "Vodka", 40, "750 mL",
        "phantom-ridge-front.png", // referenced file doesn't exist
      ]),
      csvRow(["APP-902", "spirits", "Empty Crate", "Gin", 42, "750 mL", ""]),
    ].join("\n") + "\n",
  );

  await writeFile(
    path.join(dir, "missing-column.csv"),
    [
      // net_contents column absent entirely
      "application_id,beverage_type,brand_name,class_type,abv,image_files",
      csvRow([
        "APP-001", "spirits", "Old Tom Distillery",
        "Kentucky Straight Bourbon Whiskey", 45,
        "app-001-front.png;app-001-back.png",
      ]),
    ].join("\n") + "\n",
  );
}

async function main(): Promise<void> {
  const imageCount = await renderImages();
  await writeCsv();
  await writeExpected();
  await writePreflight();
  console.log(
    `Generated ${imageCount} label images, applications.csv (${FIXTURE_CASES.length} rows), expected.json, preflight CSVs.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
