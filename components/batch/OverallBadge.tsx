// Row-level outcome → icon + text + color, the batch counterpart of the
// per-field StatusBadge. "error" is a row that couldn't be checked at all
// (bad image, repeated API failure) — distinct from a label that failed.
// iconClasses carries just the text color, for places (e.g. the progress
// tallies) that render the icon outside a badge.

import {
  CheckIcon,
  CircleAlertIcon,
  TriangleAlertIcon,
  XIcon,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { OverallStatus } from "@/core/types";

export type RowOutcome = OverallStatus | "error";

export const OUTCOME_BADGE: Record<
  RowOutcome,
  { icon: LucideIcon; text: string; classes: string; iconClasses: string }
> = {
  pass: {
    icon: CheckIcon,
    text: "Pass",
    classes: "border-success/30 bg-success/10 text-success",
    iconClasses: "text-success",
  },
  needs_review: {
    icon: TriangleAlertIcon,
    text: "Needs review",
    classes: "border-warning/40 bg-warning/10 text-warning",
    iconClasses: "text-warning",
  },
  fail: {
    icon: XIcon,
    text: "Problems found",
    classes: "border-destructive/30 bg-destructive/10 text-destructive",
    iconClasses: "text-destructive",
  },
  error: {
    icon: CircleAlertIcon,
    text: "Couldn't check",
    classes: "border-border bg-muted text-muted-foreground",
    iconClasses: "text-muted-foreground",
  },
};

export function OverallBadge({ outcome }: { outcome: RowOutcome }) {
  const { icon: Icon, text, classes } = OUTCOME_BADGE[outcome];
  return (
    <Badge variant="outline" className={`h-auto gap-1.5 px-2.5 py-1 text-sm font-medium ${classes}`}>
      <Icon aria-hidden="true" className="size-3.5!" />
      {text}
    </Badge>
  );
}
