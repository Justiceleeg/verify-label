// Alcohol-content matcher (PRD check 3): value match, format validity,
// proof = 2×ABV cross-check, wine ranges, beverage-type omission rules.

import { alcoholContentRequired, allowsAbvRange, wineRangeMaxWidth } from "../rules/beverage";
import type { ApplicationData, LabelFields, Verdict } from "../types";
import { parseAlcoholStatement, parseProof } from "./normalize";
import { absence, verdict } from "./verdicts";

const EPSILON = 1e-6;

function eq(a: number, b: number): boolean {
  return Math.abs(a - b) < EPSILON;
}

function fmt(n: number): string {
  return `${n}%`;
}

export function compareAlcohol(
  app: ApplicationData,
  fields: LabelFields,
): Verdict {
  const stmt = fields.alcohol_content;
  const proofField = fields.proof;
  const appValue = fmt(app.abv);
  const labelProof = proofField.value !== null ? parseProof(proofField.value) : null;

  if (stmt.value === null) {
    // No alc/vol statement — a printed proof can still tell us the strength.
    if (labelProof !== null) {
      const impliedAbv = labelProof / 2;
      if (eq(impliedAbv, app.abv)) {
        return verdict(
          "alcohol_content",
          "probable_match",
          proofField.value,
          appValue,
          `No alcohol-by-volume statement found, but the proof matches (${labelProof} proof = ${fmt(impliedAbv)} ABV). An alc/vol statement is still required — verify it isn't elsewhere on the label.`,
        );
      }
      return verdict(
        "alcohol_content",
        "mismatch",
        proofField.value,
        appValue,
        `Doesn't match — the label's proof implies ${fmt(impliedAbv)} ABV, application says ${appValue}.`,
      );
    }

    if (!alcoholContentRequired(app)) {
      return verdict(
        "alcohol_content",
        "match",
        null,
        appValue,
        app.beverage_type === "wine"
          ? `No alcohol content stated — allowed for ${app.class_type} at ${appValue} ABV.`
          : "No alcohol content stated — optional for this malt beverage.",
      );
    }

    if (absence(stmt) === "absent") {
      return verdict(
        "alcohol_content",
        "mismatch",
        null,
        appValue,
        "Alcohol content is required but wasn't found on the label.",
      );
    }
    return verdict(
      "alcohol_content",
      "unreadable",
      null,
      appValue,
      "Couldn't read the alcohol content from the image.",
    );
  }

  const parsed = parseAlcoholStatement(stmt.value);
  if (!parsed) {
    return verdict(
      "alcohol_content",
      "probable_match",
      stmt.value,
      appValue,
      `Found an alcohol statement ("${stmt.value}") but couldn't make out a percentage. Verify against the label.`,
    );
  }

  // Stated as a range — only wine may do that (§4.36).
  if (!eq(parsed.low, parsed.high)) {
    if (!allowsAbvRange(app.beverage_type)) {
      return verdict(
        "alcohol_content",
        "mismatch",
        stmt.value,
        appValue,
        `The label states a range (${fmt(parsed.low)}–${fmt(parsed.high)}); only wine labels may state a range.`,
      );
    }
    const width = parsed.high - parsed.low;
    const maxWidth = wineRangeMaxWidth(app.abv);
    if (width > maxWidth + EPSILON) {
      return verdict(
        "alcohol_content",
        "mismatch",
        stmt.value,
        appValue,
        `The stated range is ${width} points wide; the maximum is ${maxWidth} points for a wine at ${appValue} ABV.`,
      );
    }
    if (app.abv < parsed.low - EPSILON || app.abv > parsed.high + EPSILON) {
      return verdict(
        "alcohol_content",
        "mismatch",
        stmt.value,
        appValue,
        `Doesn't match — the application's ${appValue} falls outside the stated range ${fmt(parsed.low)}–${fmt(parsed.high)}.`,
      );
    }
    if (!parsed.formatValid) {
      return verdict(
        "alcohol_content",
        "probable_match",
        stmt.value,
        appValue,
        `The application's ${appValue} falls within the stated range, but the statement format looks nonstandard ("${stmt.value}"). Verify against the label.`,
      );
    }
    return verdict(
      "alcohol_content",
      "match",
      stmt.value,
      appValue,
      `The application's ${appValue} falls within the stated range ${fmt(parsed.low)}–${fmt(parsed.high)}.`,
    );
  }

  // Single stated value.
  if (!eq(parsed.low, app.abv)) {
    return verdict(
      "alcohol_content",
      "mismatch",
      stmt.value,
      appValue,
      `Doesn't match — label says ${fmt(parsed.low)}, application says ${appValue}.`,
    );
  }

  // Proof cross-check: proof must equal 2 × the label's ABV (§5.65).
  if (labelProof !== null && !eq(labelProof, 2 * parsed.low)) {
    return verdict(
      "alcohol_content",
      "mismatch",
      `${stmt.value} / ${proofField.value}`,
      appValue,
      `The label contradicts itself — ${fmt(parsed.low)} ABV should read ${2 * parsed.low} proof, but the label says ${labelProof} proof.`,
    );
  }

  if (!parsed.formatValid) {
    return verdict(
      "alcohol_content",
      "probable_match",
      stmt.value,
      appValue,
      `The value matches, but the statement format looks nonstandard ("${stmt.value}" — expected a form like "Alc. ${app.abv}% by Vol."). Verify against the label.`,
    );
  }

  // §5.65(b)(1)(i): a proof statement must share the alc/vol statement's
  // field of vision. Proxy: same source image.
  if (
    labelProof !== null &&
    proofField.sourceImage !== null &&
    stmt.sourceImage !== null &&
    proofField.sourceImage !== stmt.sourceImage
  ) {
    return verdict(
      "alcohol_content",
      "probable_match",
      `${stmt.value} / ${proofField.value}`,
      appValue,
      `The value matches and the proof is consistent, but the proof was read from a different image than the alc/vol statement — they must appear in the same field of vision. Verify on the label.`,
    );
  }

  return verdict(
    "alcohol_content",
    "match",
    stmt.value,
    appValue,
    labelProof !== null
      ? `Matches the application, and the proof checks out (${labelProof} proof = ${fmt(parsed.low)} ABV).`
      : "Matches the application.",
  );
}
