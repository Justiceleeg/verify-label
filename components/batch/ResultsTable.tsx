"use client";

// Batch results table: one row per application, filling in live as the
// orchestrator settles rows. Sortable by status (worst first, so agents
// triage flagged rows) or back to CSV order. Settled rows open a detail view.

import { useState } from "react";
import type { Verdict } from "@/core/types";
import type { BatchRow, RowState } from "@/lib/batch/run";
import { FIELD_LABELS } from "../fieldLabels";
import { OverallBadge } from "./OverallBadge";

type SortMode = "csv" | "worst_first" | "best_first";

/** Triage order: broken and failing rows surface first. */
const SEVERITY: Record<string, number> = {
  fail: 0,
  error: 1,
  needs_review: 2,
  running: 3,
  pending: 4,
  pass: 5,
};

function severity(state: RowState): number {
  if (state.status === "done") return SEVERITY[state.result.overall];
  return SEVERITY[state.status];
}

function StatusCell({ state }: { state: RowState }) {
  switch (state.status) {
    case "pending":
      return <span className="text-sm text-gray-500 dark:text-gray-400">Waiting…</span>;
    case "running":
      return (
        <span className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <span
            aria-hidden="true"
            className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"
          />
          {state.retrying ? "Retrying…" : "Checking…"}
        </span>
      );
    case "done":
      return <OverallBadge outcome={state.result.overall} />;
    case "error":
      return <OverallBadge outcome="error" />;
  }
}

/** One line summarizing what (if anything) needs the agent's attention. */
function summary(state: RowState): string {
  if (state.status === "error") return state.message;
  if (state.status !== "done") return "";
  const flagged = state.result.verdicts.filter((v: Verdict) => v.status !== "match");
  if (flagged.length === 0) return "All fields match";
  return flagged.map((v) => FIELD_LABELS[v.field]).join(", ");
}

const SORT_LABELS: Record<SortMode, string> = {
  csv: "CSV order",
  worst_first: "problems first",
  best_first: "passes first",
};

export function ResultsTable({
  rows,
  onSelect,
}: {
  rows: BatchRow[];
  onSelect: (line: number) => void;
}) {
  const [sort, setSort] = useState<SortMode>("csv");

  const sorted = [...rows];
  if (sort !== "csv") {
    const direction = sort === "worst_first" ? 1 : -1;
    // Stable sort keeps CSV order within each severity band.
    sorted.sort((a, b) => direction * (severity(a.state) - severity(b.state)));
  }

  function cycleStatusSort() {
    setSort((s) => (s === "worst_first" ? "best_first" : "worst_first"));
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <caption className="sr-only">
          Verification results, sorted by {SORT_LABELS[sort]}
        </caption>
        <thead>
          <tr className="border-b border-gray-300 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-400">
            <th scope="col" className="py-2 pr-4">
              <button
                type="button"
                onClick={cycleStatusSort}
                className="font-semibold hover:text-gray-900 dark:hover:text-gray-200"
              >
                Status{" "}
                <span aria-hidden="true">
                  {sort === "worst_first" ? "▾" : sort === "best_first" ? "▴" : "↕"}
                </span>
              </button>
            </th>
            <th scope="col" className="py-2 pr-4">
              <button
                type="button"
                onClick={() => setSort("csv")}
                className="font-semibold hover:text-gray-900 dark:hover:text-gray-200"
              >
                Application <span aria-hidden="true">{sort === "csv" ? "▾" : "↕"}</span>
              </button>
            </th>
            <th scope="col" className="py-2 pr-4">
              Brand
            </th>
            <th scope="col" className="py-2">
              Details
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => {
            const settled = row.state.status === "done" || row.state.status === "error";
            return (
              <tr
                key={row.line}
                onClick={settled ? () => onSelect(row.line) : undefined}
                className={`border-b border-gray-200 dark:border-gray-800 ${
                  settled ? "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900" : ""
                }`}
              >
                <td className="py-3 pr-4">
                  <StatusCell state={row.state} />
                </td>
                <td className="py-3 pr-4">
                  {settled ? (
                    <button
                      type="button"
                      onClick={() => onSelect(row.line)}
                      className="font-medium text-blue-700 underline dark:text-blue-400"
                    >
                      {row.application.application_id}
                    </button>
                  ) : (
                    <span className="font-medium">{row.application.application_id}</span>
                  )}
                </td>
                <td className="py-3 pr-4">{row.application.brand_name}</td>
                <td className="max-w-md py-3 text-sm text-gray-700 dark:text-gray-300">
                  {summary(row.state)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
