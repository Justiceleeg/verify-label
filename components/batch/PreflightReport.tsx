"use client";

// Pre-flight report (PRD "Batch processing" step 1): everything wrong with
// the CSV/image pairing before any API call. Problem rows are excluded from
// the run, never silently skipped — the agent sees exactly what won't be
// checked and why, then starts the batch with one obvious button.

import type { PreflightResult } from "@/lib/batch/preflight";

interface PreflightReportProps {
  result: PreflightResult;
  onStart: () => void;
  disabled?: boolean;
}

export function PreflightReport({ result, onStart, disabled }: PreflightReportProps) {
  if (!result.ok) {
    return (
      <div
        role="alert"
        className="rounded-lg bg-red-100 p-4 text-red-900 dark:bg-red-950 dark:text-red-200"
      >
        <p className="font-semibold">This CSV can&apos;t be used</p>
        <p className="mt-1 text-sm">{result.fileError}</p>
      </div>
    );
  }

  const { rows, problems, orphanImages } = result;
  const total = rows.length + problems.length;

  return (
    <div className="flex flex-col gap-4">
      {problems.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950">
          {/* Single template expression: this Next version trims the leading
              space of a text chunk that trails the last JSX expression. */}
          <p className="font-semibold text-amber-900 dark:text-amber-200">
            {`${problems.length} of ${total} rows can't be checked`}
          </p>
          <p className="mt-1 text-sm text-amber-900 dark:text-amber-200">
            Fix the CSV (or add the missing images) and the report updates
            automatically. Starting now skips these rows.
          </p>
          <ul className="mt-3 flex max-h-64 flex-col gap-2 overflow-y-auto text-sm text-amber-950 dark:text-amber-100">
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
        <details className="rounded-lg border border-gray-200 p-4 text-sm dark:border-gray-800">
          <summary className="cursor-pointer font-medium">
            {`${orphanImages.length} image${orphanImages.length === 1 ? "" : "s"} no row mentions — they'll be ignored`}
          </summary>
          <p className="mt-2 break-words text-gray-600 dark:text-gray-400">
            {orphanImages.join(", ")}
          </p>
        </details>
      )}

      <div>
        <button
          type="button"
          onClick={onStart}
          disabled={disabled || rows.length === 0}
          className="rounded-lg bg-blue-700 px-6 py-3.5 text-lg font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
        >
          Check {rows.length} label{rows.length === 1 ? "" : "s"}
        </button>
        {rows.length === 0 && (
          <p className="mt-2 text-sm text-red-700 dark:text-red-400">
            No rows are ready — fix the problems above first.
          </p>
        )}
      </div>
    </div>
  );
}
