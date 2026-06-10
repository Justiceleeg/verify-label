// Verdict status → emoji + text + color. Always pairs the color with a
// text label so the meaning never relies on color alone.

import type { VerdictStatus } from "@/core/types";
import { Badge } from "@/components/ui/badge";

const STATUS: Record<VerdictStatus, { emoji: string; text: string; classes: string }> = {
  match: {
    emoji: "✅",
    text: "Match",
    classes: "border-success/30 bg-success/10 text-success",
  },
  probable_match: {
    emoji: "⚠️",
    text: "Needs review",
    classes: "border-warning/40 bg-warning/10 text-warning",
  },
  mismatch: {
    emoji: "❌",
    text: "Doesn't match",
    classes: "border-destructive/30 bg-destructive/10 text-destructive",
  },
  unreadable: {
    emoji: "❓",
    text: "Couldn't read",
    classes: "border-border bg-muted text-muted-foreground",
  },
};

export function StatusBadge({ status }: { status: VerdictStatus }) {
  const { emoji, text, classes } = STATUS[status];
  return (
    <Badge variant="outline" className={`h-auto gap-1.5 px-2.5 py-1 text-sm font-medium ${classes}`}>
      <span aria-hidden="true">{emoji}</span>
      {text}
    </Badge>
  );
}
