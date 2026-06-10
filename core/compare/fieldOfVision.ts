// Same-field-of-vision check (PRD check 6, spirits only, §5.63): brand name,
// class/type, and alcohol content must appear on the same side of the
// container. With front/back images, flag when they were extracted from
// different images.

import { requiresSameFieldOfVision } from "../rules/beverage";
import type { ApplicationData, LabelFields, Verdict } from "../types";
import { verdict } from "./verdicts";

/** Returns null when the check doesn't apply (non-spirits). */
export function compareFieldOfVision(
  app: ApplicationData,
  fields: LabelFields,
): Verdict | null {
  if (!requiresSameFieldOfVision(app.beverage_type)) return null;

  // The alcohol content may be shown as an alc/vol statement or proof.
  const alcohol =
    fields.alcohol_content.value !== null ? fields.alcohol_content : fields.proof;
  const trio = [
    { name: "brand name", field: fields.brand_name },
    { name: "class/type", field: fields.class_type },
    { name: "alcohol content", field: alcohol },
  ];

  const missing = trio.filter(
    ({ field }) => field.value === null || field.sourceImage === null,
  );
  if (missing.length > 0) {
    return verdict(
      "same_field_of_vision",
      "unreadable",
      null,
      null,
      `Couldn't check — ${missing.map((m) => m.name).join(" and ")} ${missing.length === 1 ? "wasn't" : "weren't"} located on the images.`,
    );
  }

  const sources = new Set(trio.map(({ field }) => field.sourceImage));
  if (sources.size === 1) {
    return verdict(
      "same_field_of_vision",
      "match",
      null,
      null,
      "Brand name, class/type, and alcohol content all appear on the same label image.",
    );
  }

  return verdict(
    "same_field_of_vision",
    "probable_match",
    null,
    null,
    "Brand name, class/type, and alcohol content were read from different images. Spirits must show all three on the same side of the container — verify on the physical label.",
  );
}
