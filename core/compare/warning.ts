// Government-warning matcher (PRD check 5): verbatim §16.21 text after
// whitespace normalization; caps checked in code; bold is LLM-reported
// best-effort with a stated caveat.

import { GOVERNMENT_WARNING, WARNING_HEADING } from "../rules/warning";
import type { ExtractedWarning, Verdict } from "../types";
import { normalizeWhitespace } from "./normalize";
import { absence, verdict } from "./verdicts";

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
      "The warning text doesn't match the required statement verbatim. The required wording is fixed by regulation — no paraphrasing.",
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
