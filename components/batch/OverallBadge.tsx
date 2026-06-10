// Row-level outcome → emoji + text + color, the batch counterpart of the
// per-field StatusBadge. "error" is a row that couldn't be checked at all
// (bad image, repeated API failure) — distinct from a label that failed.

import { Badge } from "@/components/ui/badge";
import type { OverallStatus } from "@/core/types";

export type RowOutcome = OverallStatus | "error";

export const OUTCOME_BADGE: Record<
  RowOutcome,
  { emoji: string; text: string; classes: string }
> = {
  pass: {
    emoji: "✅",
    text: "Pass",
    classes: "border-success/30 bg-success/10 text-success",
  },
  needs_review: {
    emoji: "⚠️",
    text: "Needs review",
    classes: "border-warning/40 bg-warning/10 text-warning",
  },
  fail: {
    emoji: "❌",
    text: "Problems found",
    classes: "border-destructive/30 bg-destructive/10 text-destructive",
  },
  error: {
    emoji: "❗",
    text: "Couldn't check",
    classes: "border-border bg-muted text-muted-foreground",
  },
};

export function OverallBadge({ outcome }: { outcome: RowOutcome }) {
  const { emoji, text, classes } = OUTCOME_BADGE[outcome];
  return (
    <Badge variant="outline" className={`h-auto gap-1.5 px-2.5 py-1 text-sm font-medium ${classes}`}>
      <span aria-hidden="true">{emoji}</span>
      {text}
    </Badge>
  );
}
