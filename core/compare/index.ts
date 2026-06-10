// Entry point: application data + extracted label fields → per-field verdicts
// + derived overall status. Pure, deterministic — no LLM judgment here.

import type { ApplicationData, LabelFields, VerificationResult } from "../types";
import { compareAlcohol } from "./alcohol";
import { compareFieldOfVision } from "./fieldOfVision";
import { compareNetContents } from "./netContents";
import { compareTextField } from "./text";
import { compareWarning } from "./warning";
import { deriveOverall } from "./verdicts";

export function compare(
  app: ApplicationData,
  extracted: LabelFields,
): VerificationResult {
  const verdicts = [
    compareTextField("brand_name", "brand name", app.brand_name, extracted.brand_name),
    compareTextField("class_type", "class/type", app.class_type, extracted.class_type),
    compareAlcohol(app, extracted),
    compareNetContents(app, extracted.net_contents),
    compareWarning(extracted.government_warning),
  ];

  const fieldOfVision = compareFieldOfVision(app, extracted);
  if (fieldOfVision) verdicts.push(fieldOfVision);

  return { extracted, verdicts, overall: deriveOverall(verdicts) };
}

export { deriveOverall } from "./verdicts";
