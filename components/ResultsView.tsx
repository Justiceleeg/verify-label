"use client";

// Single-label results screen: the shared ResultDetail plus the actions that
// only make sense in single-label mode (start over / edit and re-check).

import { Button } from "@/components/ui/button";
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
        <Button type="button" size="lg" onClick={onReset} className="h-11 px-6 text-base">
          Check another label
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={onEdit}
          className="h-11 px-6 text-base"
        >
          Edit and re-check
        </Button>
      </div>
    </div>
  );
}
