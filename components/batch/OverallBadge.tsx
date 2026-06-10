// Row-level outcome → emoji + text + color, the batch counterpart of the
// per-field StatusBadge. "error" is a row that couldn't be checked at all
// (bad image, repeated API failure) — distinct from a label that failed.

import type { OverallStatus } from "@/core/types";

export type RowOutcome = OverallStatus | "error";

export const OUTCOME_BADGE: Record<
  RowOutcome,
  { emoji: string; text: string; classes: string }
> = {
  pass: {
    emoji: "✅",
    text: "Pass",
    classes: "bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-200",
  },
  needs_review: {
    emoji: "⚠️",
    text: "Needs review",
    classes: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  },
  fail: {
    emoji: "❌",
    text: "Problems found",
    classes: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200",
  },
  error: {
    emoji: "❗",
    text: "Couldn't check",
    classes: "bg-gray-200 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  },
};

export function OverallBadge({ outcome }: { outcome: RowOutcome }) {
  const { emoji, text, classes } = OUTCOME_BADGE[outcome];
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-sm font-medium ${classes}`}
    >
      <span aria-hidden="true">{emoji}</span>
      {text}
    </span>
  );
}
