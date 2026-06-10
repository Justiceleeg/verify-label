"use client";

// Pre-flight report (PRD "Batch processing" step 1): everything wrong with
// the CSV/image pairing before any API call. Problem rows are excluded from
// the run, never silently skipped — the agent sees exactly what won't be
// checked and why, then starts the batch with one obvious button.

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { PreflightResult } from "@/lib/batch/preflight";

interface PreflightReportProps {
  result: PreflightResult;
  onStart: () => void;
  disabled?: boolean;
}

export function PreflightReport({ result, onStart, disabled }: PreflightReportProps) {
  if (!result.ok) {
    return (
      <Alert variant="destructive" className="border-destructive/30 bg-destructive/5">
        <AlertTitle>This CSV can&apos;t be used</AlertTitle>
        <AlertDescription>{result.fileError}</AlertDescription>
      </Alert>
    );
  }

  const { rows, problems, orphanImages } = result;
  const total = rows.length + problems.length;

  return (
    <div className="flex flex-col gap-4">
      {problems.length > 0 && (
        <div className="rounded-md border border-warning/40 bg-warning/10 p-4">
          {/* Single template expression: this Next version trims the leading
              space of a text chunk that trails the last JSX expression. */}
          <p className="font-semibold text-warning">
            {`${problems.length} of ${total} rows can't be checked`}
          </p>
          <p className="mt-1 text-sm text-warning">
            Fix the CSV (or add the missing images) and the report updates
            automatically. Starting now skips these rows.
          </p>
          <ul className="mt-3 flex max-h-64 flex-col gap-2 overflow-y-auto text-sm text-foreground/80">
            {problems.map((problem) => (
              <li key={problem.line}>
                <span className="font-semibold">
                  Line {problem.line}
                  {problem.applicationId ? ` (${problem.applicationId})` : ""}:
                </span>
                {problem.messages.length === 1 ? (
                  <span> {problem.messages[0]}</span>
                ) : (
                  <ul className="ml-5 list-disc">
                    {problem.messages.map((message) => (
                      <li key={message}>{message}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {orphanImages.length > 0 && (
        <details className="rounded-md border bg-card p-4 text-sm">
          <summary className="cursor-pointer font-medium">
            {`${orphanImages.length} image${orphanImages.length === 1 ? "" : "s"} no row mentions — they'll be ignored`}
          </summary>
          <p className="mt-2 break-words text-muted-foreground">
            {orphanImages.join(", ")}
          </p>
        </details>
      )}

      <div>
        <Button
          type="button"
          size="lg"
          onClick={onStart}
          disabled={disabled || rows.length === 0}
          className="h-12 px-6 text-base"
        >
          Check {rows.length} label{rows.length === 1 ? "" : "s"}
        </Button>
        {rows.length === 0 && (
          <p className="mt-2 text-sm text-destructive">
            No rows are ready — fix the problems above first.
          </p>
        )}
      </div>
    </div>
  );
}
