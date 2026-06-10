// The extraction prompt and tool schema — the artifact the eval loop
// iterates on (scripts/extract-eval.ts runs it against fixtures/).
// Design constraints, in order of importance:
//   1. Faithful transcription. The fixtures seed half-point ABV deltas and
//      single-word warning edits; a model that rounds, autocorrects, or
//      recites the §16.21 text from memory misses them.
//   2. Honest nulls. "Confidently absent" (null + high confidence) and
//      "printed but unreadable" (null + low confidence) are different
//      verdicts downstream (❌ vs ❓) — never let the model guess.
//   3. Decoy resistance. Ages, batch numbers, founding years, addresses,
//      and serving suggestions are full of field-shaped numbers.

import type Anthropic from "@anthropic-ai/sdk";
import type { BeverageType } from "../types";

export const EXTRACTION_TOOL_NAME = "report_label_fields";

/** Schema for a plain extracted field (snake_case on the wire). */
const FIELD_SCHEMA = (valueDescription: string) => ({
  type: "object" as const,
  additionalProperties: false,
  required: ["value", "confidence", "source_image"],
  properties: {
    value: {
      type: ["string", "null"],
      description: valueDescription,
    },
    confidence: {
      type: "string",
      enum: ["high", "medium", "low"],
      description:
        'How sure you are of this reading. With value null: "high" means confidently absent from every image; "medium"/"low" mean something is printed but you could not read it.',
    },
    source_image: {
      type: ["integer", "null"],
      description:
        "0-based index of the image this field was read from. null when value is null.",
    },
  },
});

export const EXTRACTION_TOOL: Anthropic.Messages.Tool = {
  name: EXTRACTION_TOOL_NAME,
  description:
    "Report every regulated field transcribed from the label images. Transcription only — exact characters as printed, no judgment, no correction.",
  // Server-side schema enforcement: the tool input is guaranteed to match
  // input_schema, so parse.ts failures indicate a bug, not model drift.
  strict: true,
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "legibility_notes",
      "brand_name",
      "class_type",
      "alcohol_content",
      "proof",
      "net_contents",
      "government_warning",
    ],
    properties: {
      // Listed first so the legibility assessment is generated before any
      // field — it anchors the absent-vs-unreadable call for every null.
      legibility_notes: {
        type: "string",
        description:
          "Before reporting any field: for each image, is every part of the label sharp and legible? Note any region that is blurred, smudged, glared out, washed out, cropped off, or otherwise unreadable, and what kind of text might be printed there. Look closely for subtle defects — a translucent smear or lens smudge that softens a patch of text counts as an unreadable region even when the rest of the image is sharp, and so does a patch where you can tell ink is present but cannot resolve the characters. If every part of every image is legible, say exactly that.",
      },
      brand_name: FIELD_SCHEMA(
        "The brand name exactly as printed, preserving case and punctuation (e.g. \"STONE'S THROW\", not \"Stone's Throw\").",
      ),
      class_type: FIELD_SCHEMA(
        'The class/type designation exactly as printed, e.g. "Kentucky Straight Bourbon Whiskey", "India Pale Ale", "Red Table Wine". Not the brand name.',
      ),
      alcohol_content: FIELD_SCHEMA(
        'The complete alcohol-by-volume statement exactly as printed, e.g. "Alc. 45% by Vol.", "13.5 percent alcohol by volume", "Alcohol 12% to 14% by Volume". NOT the proof statement.',
      ),
      proof: FIELD_SCHEMA(
        'The proof statement exactly as printed if present, e.g. "90 Proof". Never derive it from the alcohol percentage — report only what is printed.',
      ),
      net_contents: FIELD_SCHEMA(
        'The net contents statement exactly as printed, including any supplemental unit, e.g. "750 mL", "750 mL (25.4 FL. OZ.)", "12 FL. OZ.".',
      ),
      government_warning: {
        type: "object",
        additionalProperties: false,
        required: [
          "value",
          "confidence",
          "source_image",
          "heading_bold",
          "remainder_bold",
        ],
        properties: {
          ...FIELD_SCHEMA(
            'The complete government health warning statement transcribed character-for-character FROM THE IMAGE — never from memory. Start the value with the heading exactly as printed (e.g. "GOVERNMENT WARNING:" or however it actually appears) — the heading is part of the statement, not a separate element. Labels sometimes deviate from the standard wording by a single word or letter case; reproduce the deviation exactly.',
          ).properties,
          heading_bold: {
            type: ["boolean", "null"],
            description:
              'Whether the "GOVERNMENT WARNING" heading appears in bold type. Best-effort from the image; null when you cannot tell.',
          },
          remainder_bold: {
            type: ["boolean", "null"],
            description:
              "Whether the warning text after the heading appears in bold type. Best-effort from the image; null when you cannot tell.",
          },
        },
      },
    },
  },
};

export const SYSTEM_PROMPT = `You transcribe United States alcohol beverage labels for compliance review. You will be shown one or two photographs of a container's labels (image 0 first; image 1, when present, is typically the other side of the container). Report what is printed using the ${EXTRACTION_TOOL_NAME} tool.

You are a transcriber, not a judge. Report exactly what the label says; render no opinion on whether it is correct or compliant.

Rules:

1. Transcribe characters exactly as printed. Never correct spelling, normalize wording, round numbers, or complete text from memory. If the label says "44.5%", report "44.5%" — not "45%". If it says "Whisky", report "Whisky" — not "Whiskey". This matters most for the government warning: you know the standard wording, but labels sometimes deviate from it by one word or by capitalization, and catching that deviation is the entire purpose of this transcription. Read it character by character from the image.

2. Honest nulls, decided by your own legibility_notes. Fill in legibility_notes first, then apply this rule mechanically to every field you could not find: if your legibility_notes mention ANY obscured or unreadable region, the field could be printed there — report null with confidence "low". If your legibility_notes say every part of every image is legible, then not finding the field means it is not there — report null with confidence "high", a confident absence. Do not hedge a clean-image absence to "low", and never guess or reconstruct an unreadable field; a wrong guess is worse than an honest null.

3. Confidence reflects legibility of that field only: "high" when clearly legible, "medium" when legible but degraded (you read it, with some effort), "low" only alongside a null you couldn't read.

4. source_image is the 0-based index of the image you read the field from. When a field appears on both images, report the clearest reading and its image index.

5. Ignore decorative and incidental text. Ages ("AGED 12 YEARS"), batch and barrel numbers, bottle counts, founding years ("EST. 1897"), street addresses, bottler/producer lines, tasting notes, and serving suggestions are not regulated fields. A street address containing "750" is not a net contents statement; "AGED 12 YEARS" is not an alcohol content; "BATCH No. 86" is not a proof.

6. alcohol_content and proof are separate fields. alcohol_content is the percentage alcohol-by-volume statement in any of its printed forms (abbreviated, spelled out, or a range). proof is a distinct "X Proof" statement. Report each only if it is printed; never compute one from the other.

7. Government warning bold observations: heading_bold and remainder_bold are best-effort calls about bold type from a photograph, and the reliable signal is the weight CONTRAST between the heading and the text after it — judge them together, not in isolation. Heading noticeably heavier than the body: heading_bold true, remainder_bold false. Heading and body the same weight: if that shared weight is light, heading_bold false; if everything is heavy, remainder_bold true. Use null only when the print is too small or degraded to compare weights at all.`;

/** The per-request user text. Only the beverage type is shared with the
 * model — never application field values, which would bias transcription. */
export function userText(beverageType: BeverageType): string {
  const product =
    beverageType === "spirits"
      ? "a distilled spirits product"
      : beverageType === "wine"
      ? "a wine product"
      : "a malt beverage product";
  return `These are the label image(s) for ${product}. Transcribe the regulated fields with ${EXTRACTION_TOOL_NAME}.`;
}
