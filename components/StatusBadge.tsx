// Verdict status → emoji + text + color. Always pairs the color with a
// text label so the meaning never relies on color alone.

import type { VerdictStatus } from "@/core/types";

const STATUS: Record<VerdictStatus, { emoji: string; text: string; classes: string }> = {
  match: {
    emoji: "✅",
    text: "Match",
    classes: "bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-200",
  },
  probable_match: {
    emoji: "⚠️",
    text: "Needs review",
    classes: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  },
  mismatch: {
    emoji: "❌",
    text: "Doesn't match",
    classes: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200",
  },
  unreadable: {
    emoji: "❓",
    text: "Couldn't read",
    classes: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  },
};

export function StatusBadge({ status }: { status: VerdictStatus }) {
  const { emoji, text, classes } = STATUS[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-sm font-medium ${classes}`}
    >
      <span aria-hidden="true">{emoji}</span>
      {text}
    </span>
  );
}
