// Human-readable names for verdict fields, shown in the results table.

import type { Verdict } from "@/core/types";

export const FIELD_LABELS: Record<Verdict["field"], string> = {
  brand_name: "Brand name",
  class_type: "Class/type",
  alcohol_content: "Alcohol content",
  proof: "Proof",
  net_contents: "Net contents",
  government_warning: "Government warning",
  same_field_of_vision: "Same side of container",
};
