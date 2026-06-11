"use client";

// Live batch progress: n/total bar plus running outcome tallies
// (PRD "Batch processing" step 4). Stays visible above the results table
// while rows stream in, and doubles as the summary line when finished.

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
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
    <div className="flex flex-col gap-3 rounded-md border bg-card p-4 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold" role="status">
          {running
            ? `Checking labels… ${settled} of ${total} done`
            : `Checked ${settled} of ${total} labels`}
        </p>
        {running && (
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            Stop checking
          </Button>
        )}
      </div>

      <Progress value={percent} aria-label="Labels checked" className="h-2" />

      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {TALLY_ORDER.map((outcome) => {
          const { icon: Icon, text, iconClasses } = OUTCOME_BADGE[outcome];
          return (
            <li key={outcome} className="flex items-center gap-1.5">
              <Icon aria-hidden="true" className={`size-4 ${iconClasses}`} />
              <span>{`${byOutcome[outcome]} ${text.toLowerCase()}`}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
