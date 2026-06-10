// Government-warning matcher (PRD check 5): verbatim §16.21 text after
// whitespace normalization; caps checked in code; bold is LLM-reported
// best-effort with a stated caveat.

import { GOVERNMENT_WARNING, WARNING_HEADING } from "../rules/warning";
import type { ExtractedWarning, Verdict } from "../types";
import { normalizeWhitespace } from "./normalize";
import { absence, verdict } from "./verdicts";

const REGULATION_REMINDER =
  "The required wording is fixed by regulation — no paraphrasing.";

/** First ~8 words of a token span, with an ellipsis if it runs longer. */
function snippet(tokens: string[]): string {
  const head = tokens.slice(0, 8).join(" ");
  return tokens.length > 8 ? `${head}…` : head;
}

/**
 * Explain where a non-verbatim warning first diverges from the §16.21 text.
 * Expects whitespace-normalized input that is known to differ from the
 * required text by wording (not just capitalization).
 */
export function explainWarningDivergence(labelText: string): string {
  const labelTokens = labelText.split(" ");
  const requiredTokens = GOVERNMENT_WARNING.split(" ");
  const shared = Math.min(labelTokens.length, requiredTokens.length);

  for (let i = 0; i < shared; i++) {
    if (labelTokens[i].toLowerCase() !== requiredTokens[i].toLowerCase()) {
      return (
        `The warning text doesn't match the required statement. The first difference is at word ${i + 1}: ` +
        `the label says "${labelTokens[i]}" where the required text says "${requiredTokens[i]}". ` +
        REGULATION_REMINDER
      );
    }
  }

  if (labelTokens.length < requiredTokens.length) {
    return (
      `The label's warning stops early. It is missing the required text starting at word ${shared + 1}: ` +
      `"${snippet(requiredTokens.slice(shared))}" ` +
      REGULATION_REMINDER
    );
  }
  if (labelTokens.length > requiredTokens.length) {
    return (
      `The label adds extra text after the required statement, starting with: ` +
      `"${snippet(labelTokens.slice(shared))}" ` +
      REGULATION_REMINDER
    );
  }

  // Unreachable when the caller has already ruled out a case-insensitive
  // match, but keep a sensible fallback.
  return `The warning text doesn't match the required statement verbatim. ${REGULATION_REMINDER}`;
}

export function compareWarning(extracted: ExtractedWarning): Verdict {
  if (extracted.value === null) {
    if (absence(extracted) === "absent") {
      return verdict(
        "government_warning",
        "mismatch",
        null,
        GOVERNMENT_WARNING,
        "The government warning statement was not found on the label. It is required on every container.",
      );
    }
    return verdict(
      "government_warning",
      "unreadable",
      null,
      GOVERNMENT_WARNING,
      "Couldn't read the government warning from the image.",
    );
  }

  const labelText = normalizeWhitespace(extracted.value);

  if (labelText !== GOVERNMENT_WARNING) {
    if (labelText.toLowerCase() === GOVERNMENT_WARNING.toLowerCase()) {
      // Wording is right; capitalization isn't.
      if (!labelText.startsWith(WARNING_HEADING)) {
        const shownHeading = labelText.slice(0, WARNING_HEADING.length);
        return verdict(
          "government_warning",
          "mismatch",
          labelText,
          GOVERNMENT_WARNING,
          `"GOVERNMENT WARNING" must appear in all capital letters; the label shows "${shownHeading}".`,
        );
      }
      return verdict(
        "government_warning",
        "probable_match",
        labelText,
        GOVERNMENT_WARNING,
        "The wording matches, but capitalization differs from the required text. Verify against the label.",
      );
    }
    return verdict(
      "government_warning",
      "mismatch",
      labelText,
      GOVERNMENT_WARNING,
      explainWarningDivergence(labelText),
    );
  }

  // Text is verbatim, heading caps included. Now the bold requirements:
  // heading bold, remainder not bold. Detection from photos is best-effort.
  if (extracted.headingBold === false) {
    return verdict(
      "government_warning",
      "probable_match",
      labelText,
      GOVERNMENT_WARNING,
      `Text matches verbatim, but "GOVERNMENT WARNING" doesn't appear to be in bold type (read from the image — verify on the label).`,
    );
  }
  if (extracted.remainderBold === true) {
    return verdict(
      "government_warning",
      "probable_match",
      labelText,
      GOVERNMENT_WARNING,
      "Text matches verbatim, but the statement after the heading appears to be in bold type; only \"GOVERNMENT WARNING\" should be bold (read from the image — verify on the label).",
    );
  }

  const boldVerified =
    extracted.headingBold === true && extracted.remainderBold === false;
  return verdict(
    "government_warning",
    "match",
    labelText,
    GOVERNMENT_WARNING,
    boldVerified
      ? "Matches the required text verbatim; formatting looks correct."
      : "Matches the required text verbatim. Bold formatting couldn't be fully verified from the image.",
  );
}
