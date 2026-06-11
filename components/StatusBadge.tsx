// Verdict status → icon + text + color. Always pairs the color with a
// text label so the meaning never relies on color alone.

import {
  CheckIcon,
  CircleHelpIcon,
  TriangleAlertIcon,
  XIcon,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { VerdictStatus } from "@/core/types";

const STATUS: Record<VerdictStatus, { icon: LucideIcon; text: string; classes: string }> = {
  match: {
    icon: CheckIcon,
    text: "Match",
    classes: "border-success/30 bg-success/10 text-success",
  },
  probable_match: {
    icon: TriangleAlertIcon,
    text: "Needs review",
    classes: "border-warning/40 bg-warning/10 text-warning",
  },
  mismatch: {
    icon: XIcon,
    text: "Doesn't match",
    classes: "border-destructive/30 bg-destructive/10 text-destructive",
  },
  unreadable: {
    icon: CircleHelpIcon,
    text: "Couldn't read",
    classes: "border-border bg-muted text-muted-foreground",
  },
};

export function StatusBadge({ status }: { status: VerdictStatus }) {
  const { icon: Icon, text, classes } = STATUS[status];
  return (
    <Badge variant="outline" className={`h-auto gap-1.5 px-2.5 py-1 text-sm font-medium ${classes}`}>
      <Icon aria-hidden="true" className="size-3.5!" />
      {text}
    </Badge>
  );
}
