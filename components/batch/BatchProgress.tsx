"use client";

// Live batch progress: n/total bar plus running outcome tallies
// (PRD "Batch processing" step 4). Stays visible above the results table
// while rows stream in, and doubles as the summary line when finished.

import type { RowState } from "@/lib/batch/run";
import { OUTCOME_BADGE, type RowOutcome } from "./OverallBadge";

export interface Tallies {
  total: number;
  settled: number;
  byOutcome: Record<RowOutcome, number>;
}

export function tally(states: Iterable<RowState>): Tallies {
  const byOutcome: Record<RowOutcome, number> = {
    pass: 0,
    needs_review: 0,
    fail: 0,
    error: 0,
  };
  let total = 0;
  let settled = 0;
  for (const state of states) {
    total += 1;
    if (state.status === "done") {
      settled += 1;
      byOutcome[state.result.overall] += 1;
    } else if (state.status === "error") {
      settled += 1;
      byOutcome.error += 1;
    }
  }
  return { total, settled, byOutcome };
}

const TALLY_ORDER: RowOutcome[] = ["pass", "needs_review", "fail", "error"];

export function BatchProgress({
  tallies,
  running,
  onCancel,
}: {
  tallies: Tallies;
  running: boolean;
  onCancel: () => void;
}) {
  const { total, settled, byOutcome } = tallies;
  const percent = total === 0 ? 0 : Math.round((settled / total) * 100);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-gray-200 p-4 dark:border-gray-800">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold" role="status">
          {running
            ? `Checking labels… ${settled} of ${total} done`
            : `Checked ${settled} of ${total} labels`}
        </p>
        {running && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900"
          >
            Stop checking
          </button>
        )}
      </div>

      <div
        role="progressbar"
        aria-valuenow={settled}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label="Labels checked"
        className="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800"
      >
        <div
          className="h-full rounded-full bg-blue-600 transition-[width] duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>

      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {TALLY_ORDER.map((outcome) => {
          const { emoji, text } = OUTCOME_BADGE[outcome];
          return (
            <li key={outcome} className="flex items-center gap-1">
              <span aria-hidden="true">{emoji}</span>
              <span>{`${byOutcome[outcome]} ${text.toLowerCase()}`}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
