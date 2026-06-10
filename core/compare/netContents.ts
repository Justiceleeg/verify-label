// Net-contents matcher (PRD check 4). Required units depend on beverage
// type: metric for spirits/wine (§5.70, §4.37), US customary for malt
// (§7.70) — the other system may only supplement, never replace.

import { requiredNetContentsUnits } from "../rules/beverage";
import type { ApplicationData, ExtractedField, Verdict } from "../types";
import { parseCustomaryContents, parseNetContents } from "./normalize";
import { absence, verdict } from "./verdicts";

export function compareNetContents(
  app: ApplicationData,
  extracted: ExtractedField,
): Verdict {
  const appValue = app.net_contents;

  if (extracted.value === null) {
    if (absence(extracted) === "absent") {
      return verdict(
        "net_contents",
        "mismatch",
        null,
        appValue,
        "No net contents found on the label.",
      );
    }
    return verdict(
      "net_contents",
      "unreadable",
      null,
      appValue,
      "Couldn't read the net contents from the image.",
    );
  }

  const labelMetric = parseNetContents(extracted.value);
  const labelCustomary = parseCustomaryContents(extracted.value);

  if (labelMetric === null && labelCustomary === null) {
    return verdict(
      "net_contents",
      "probable_match",
      extracted.value,
      appValue,
      `Couldn't make out a quantity in "${extracted.value}". Verify against the label.`,
    );
  }

  // Unit compliance for this beverage type.
  const required = requiredNetContentsUnits(app.beverage_type);
  if (required === "metric" && labelMetric === null) {
    return verdict(
      "net_contents",
      "mismatch",
      extracted.value,
      appValue,
      `The label shows only non-metric contents ("${extracted.value}"); metric units (mL or L) are required for this beverage type.`,
    );
  }
  if (required === "us_customary" && labelCustomary === null) {
    return verdict(
      "net_contents",
      "mismatch",
      extracted.value,
      appValue,
      `The label shows only metric contents ("${extracted.value}"); malt beverages must state net contents in US measure (fl. oz., pints, quarts, or gallons) — metric may only appear in addition.`,
    );
  }

  const labelMl =
    required === "metric" ? labelMetric! : labelCustomary!;
  const appMetric = parseNetContents(appValue);
  const appCustomary = parseCustomaryContents(appValue);
  const appMl = appMetric ?? appCustomary;
  if (appMl === null) {
    return verdict(
      "net_contents",
      "probable_match",
      extracted.value,
      appValue,
      `Couldn't interpret the application's net contents ("${appValue}") — check the application data.`,
    );
  }

  // Dual statements are rounded (750 mL ↔ 25.4 fl oz), so allow 1% slack
  // when the two values come from different measurement systems.
  const crossSystem =
    (required === "metric") !== (appMetric !== null);
  const tolerance = crossSystem ? appMl * 0.01 : 0.5;

  if (Math.abs(labelMl - appMl) <= tolerance) {
    const sameWording = extracted.value.trim() === appValue.trim();
    return verdict(
      "net_contents",
      "match",
      extracted.value,
      appValue,
      sameWording
        ? "Matches the application exactly."
        : `Matches the application (${extracted.value} = ${appValue}).`,
    );
  }

  const inMl = (ml: number) => `${Math.round(ml * 10) / 10} mL`;
  return verdict(
    "net_contents",
    "mismatch",
    extracted.value,
    appValue,
    `Doesn't match — label says ${extracted.value} (${inMl(labelMl)}), application says ${appValue} (${inMl(appMl)}).`,
  );
}
