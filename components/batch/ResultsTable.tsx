"use client";

// Batch results table: one row per application, filling in live as the
// orchestrator settles rows. Sortable by status (worst first, so agents
// triage flagged rows) or back to CSV order. Settled rows open a detail view.

import { ChevronDownIcon, ChevronsUpDownIcon, ChevronUpIcon } from "lucide-react";
import { useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
      return <span className="text-sm text-muted-foreground">Waiting…</span>;
    case "running":
      return (
        <span className="inline-flex items-center gap-2 text-sm text-foreground/80">
          <Spinner className="text-primary" aria-hidden="true" />
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
    <Table className="text-base">
      <TableCaption className="sr-only">
        Verification results, sorted by {SORT_LABELS[sort]}
      </TableCaption>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="px-0 pr-4">
            <button
              type="button"
              onClick={cycleStatusSort}
              className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground"
            >
              Status
              {sort === "worst_first" ? (
                <ChevronDownIcon className="size-3.5" aria-hidden="true" />
              ) : sort === "best_first" ? (
                <ChevronUpIcon className="size-3.5" aria-hidden="true" />
              ) : (
                <ChevronsUpDownIcon className="size-3.5" aria-hidden="true" />
              )}
            </button>
          </TableHead>
          <TableHead className="px-0 pr-4">
            <button
              type="button"
              onClick={() => setSort("csv")}
              className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground"
            >
              Application
              {sort === "csv" ? (
                <ChevronDownIcon className="size-3.5" aria-hidden="true" />
              ) : (
                <ChevronsUpDownIcon className="size-3.5" aria-hidden="true" />
              )}
            </button>
          </TableHead>
          <TableHead className="px-0 pr-4 text-sm font-semibold text-muted-foreground">
            Brand
          </TableHead>
          <TableHead className="px-0 text-sm font-semibold text-muted-foreground">
            Details
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((row) => {
          const settled = row.state.status === "done" || row.state.status === "error";
          return (
            <TableRow
              key={row.line}
              onClick={settled ? () => onSelect(row.line) : undefined}
              className={settled ? "cursor-pointer" : "hover:bg-transparent"}
            >
              <TableCell className="px-0 py-3 pr-4">
                <StatusCell state={row.state} />
              </TableCell>
              <TableCell className="px-0 py-3 pr-4">
                {settled ? (
                  <button
                    type="button"
                    onClick={() => onSelect(row.line)}
                    className="font-medium text-primary underline underline-offset-4 hover:text-primary/80"
                  >
                    {row.application.application_id}
                  </button>
                ) : (
                  <span className="font-medium">{row.application.application_id}</span>
                )}
              </TableCell>
              <TableCell className="px-0 py-3 pr-4 whitespace-normal">
                {row.application.brand_name}
              </TableCell>
              <TableCell className="max-w-md px-0 py-3 text-sm whitespace-normal text-muted-foreground">
                {summary(row.state)}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
