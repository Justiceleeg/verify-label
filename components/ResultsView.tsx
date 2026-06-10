"use client";

// Single-label results screen: the shared ResultDetail plus the actions that
// only make sense in single-label mode (start over / edit and re-check).

import type { VerificationResult } from "@/core/types";
import { ResultDetail } from "./ResultDetail";

interface ResultsViewProps {
  result: VerificationResult;
  files: { front: File | null; back: File | null };
  onReset: () => void;
  onEdit: () => void;
}

export function ResultsView({ result, files, onReset, onEdit }: ResultsViewProps) {
  return (
    <div className="flex flex-col gap-6">
      <ResultDetail result={result} files={files} />

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onReset}
          className="rounded-lg bg-blue-700 px-6 py-3 text-base font-semibold text-white hover:bg-blue-800"
        >
          Check another label
        </button>
        <button
          type="button"
          onClick={onEdit}
          className="rounded-lg border border-gray-300 px-6 py-3 text-base font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900"
        >
          Edit and re-check
        </button>
      </div>
    </div>
  );
}
