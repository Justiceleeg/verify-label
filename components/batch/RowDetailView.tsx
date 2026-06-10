"use client";

// Drill-in for one batch row: the same per-field detail as single-label mode
// (shared ResultDetail), with the row's images resolved lazily — zip entries
// inflate only when the agent opens the row.

import { useEffect, useState } from "react";
import type { ImageSource } from "@/lib/batch/imageSource";
import type { BatchRow } from "@/lib/batch/run";
import { ResultDetail } from "../ResultDetail";

interface RowDetailViewProps {
  row: BatchRow;
  images: Map<string, ImageSource>;
  onBack: () => void;
  /** Re-run just this row; absent while another run is in flight. */
  onRetry?: () => void;
}

export function RowDetailView({ row, images, onBack, onRetry }: RowDetailViewProps) {
  const [files, setFiles] = useState<{ front: File | null; back: File | null }>({
    front: null,
    back: null,
  });

  useEffect(() => {
    let active = true;
    Promise.all(
      row.imageNames.map((name) => images.get(name)?.getFile() ?? null),
    ).then(([front, back]) => {
      if (active) setFiles({ front: front ?? null, back: back ?? null });
    });
    return () => {
      active = false;
    };
  }, [row.imageNames, images]);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <button
          type="button"
          onClick={onBack}
          className="text-sm font-medium text-blue-700 underline dark:text-blue-400"
        >
          ← Back to all results
        </button>
        <h2 className="mt-3 text-2xl font-bold">
          {row.application.application_id} — {row.application.brand_name}
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          CSV line {row.line} · {row.application.class_type}
        </p>
      </div>

      {(row.state.status === "pending" || row.state.status === "running") && (
        <p
          role="status"
          className="flex items-center gap-2 rounded-lg border border-gray-200 p-4 text-gray-700 dark:border-gray-800 dark:text-gray-300"
        >
          <span
            aria-hidden="true"
            className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"
          />
          Checking this label…
        </p>
      )}

      {row.state.status === "done" && (
        <ResultDetail result={row.state.result} files={files} />
      )}

      {row.state.status === "error" && (
        <div
          role="alert"
          className="rounded-lg bg-red-100 p-4 text-red-900 dark:bg-red-950 dark:text-red-200"
        >
          <p className="font-semibold">This label couldn&apos;t be checked</p>
          <p className="mt-1 text-sm">{row.state.message}</p>
        </div>
      )}

      {row.state.status === "error" && onRetry && (
        <div>
          <button
            type="button"
            onClick={onRetry}
            className="rounded-lg bg-blue-700 px-6 py-3 text-base font-semibold text-white hover:bg-blue-800"
          >
            Try this row again
          </button>
        </div>
      )}
    </div>
  );
}
