"use client";

// Drill-in for one batch row: the same per-field detail as single-label mode
// (shared ResultDetail), with the row's images resolved lazily — zip entries
// inflate only when the agent opens the row.

import { useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
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
          className="text-sm font-medium text-primary underline underline-offset-4 hover:text-primary/80"
        >
          ← Back to all results
        </button>
        <h2 className="mt-3 text-2xl font-bold tracking-tight">
          {row.application.application_id} — {row.application.brand_name}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          CSV line {row.line} · {row.application.class_type}
        </p>
      </div>

      {(row.state.status === "pending" || row.state.status === "running") && (
        <p
          role="status"
          className="flex items-center gap-2 rounded-md border bg-card p-4 text-foreground/80"
        >
          <Spinner className="size-5 text-primary" aria-hidden="true" />
          Checking this label…
        </p>
      )}

      {row.state.status === "done" && (
        <ResultDetail result={row.state.result} files={files} />
      )}

      {row.state.status === "error" && (
        <Alert variant="destructive" className="border-destructive/30 bg-destructive/5">
          <AlertTitle>This label couldn&apos;t be checked</AlertTitle>
          <AlertDescription>{row.state.message}</AlertDescription>
        </Alert>
      )}

      {row.state.status === "error" && onRetry && (
        <div>
          <Button type="button" size="lg" onClick={onRetry} className="h-11 px-6 text-base">
            Try this row again
          </Button>
        </div>
      )}
    </div>
  );
}
