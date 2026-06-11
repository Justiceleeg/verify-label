"use client";

// Batch container: setup (CSV + images → live pre-flight report) → run
// (orchestrator streams row states into the table) → drill-in per row.
// All state is client-side and session-only; closing the tab abandons the
// batch (accepted trade-off, ARCHITECTURE "Client-orchestrated batch").

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { exportResultsCsv } from "@/lib/batch/exportCsv";
import { collectImageSources, type ImageSource } from "@/lib/batch/imageSource";
import { preflight, type BatchRowInput } from "@/lib/batch/preflight";
import { runBatch, type BatchRow, type RowState } from "@/lib/batch/run";
import {
  buildSampleCsv,
  DEMO_CASES,
  demoImageNames,
  fetchDemoImages,
  QUICK_BATCH_IDS,
} from "@/lib/demo";
import { BatchProgress, tally } from "./BatchProgress";
import { BatchSetup } from "./BatchSetup";
import { PreflightReport } from "./PreflightReport";
import { ResultsTable } from "./ResultsTable";
import { RowDetailView } from "./RowDetailView";

const PENDING: RowState = { status: "pending" };

function downloadCsv(content: string, filename: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function BatchChecker() {
  // --- Setup inputs ---
  const [csv, setCsv] = useState<{ name: string; text: string } | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [pickedFiles, setPickedFiles] = useState<File[]>([]);
  const [collected, setCollected] = useState<{
    sources: Map<string, ImageSource>;
    ignored: string[];
  }>({ sources: new Map(), ignored: [] });
  const [imagesError, setImagesError] = useState<string | null>(null);

  // --- Sample batch loading (demo) ---
  const [sampleProgress, setSampleProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const [sampleError, setSampleError] = useState<string | null>(null);

  // --- Run state ---
  const [stage, setStage] = useState<"setup" | "run">("setup");
  const [rows, setRows] = useState<BatchRow[]>([]);
  const [runImages, setRunImages] = useState<Map<string, ImageSource>>(new Map());
  const [running, setRunning] = useState(false);
  const [selectedLine, setSelectedLine] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Zip listing is async, so picks resolve to sources in an effect; the
  // pre-flight report below recomputes from the result automatically.
  useEffect(() => {
    let active = true;
    collectImageSources(pickedFiles).then(
      (result) => {
        if (!active) return;
        setCollected(result);
        setImagesError(null);
      },
      (err: Error) => {
        if (!active) return;
        setImagesError(`${err.message} Clear the images and try again.`);
      },
    );
    return () => {
      active = false;
    };
  }, [pickedFiles]);

  const preflightResult = useMemo(
    () => (csv && collected.sources.size > 0 ? preflight(csv.text, collected.sources.keys()) : null),
    [csv, collected],
  );

  function pickCsv(file: File) {
    const looksLikeCsv =
      file.name.toLowerCase().endsWith(".csv") || file.type.includes("csv");
    if (!looksLikeCsv) {
      setCsvError(`"${file.name}" doesn't look like a CSV file.`);
      return;
    }
    file.text().then(
      (text) => {
        setCsv({ name: file.name, text });
        setCsvError(null);
      },
      () => setCsvError(`Couldn't read "${file.name}". Try picking it again.`),
    );
  }

  /**
   * Load a shipped sample batch: build its CSV and fetch its images from
   * public/fixtures/images, then hand both to the normal setup state so
   * pre-flight and the run work exactly as with user-picked files.
   */
  async function loadSample(ids: string[], csvName: string) {
    const names = demoImageNames(ids);
    setSampleProgress({ done: 0, total: names.length });
    setSampleError(null);
    try {
      const files = await fetchDemoImages(names, (done, total) =>
        setSampleProgress({ done, total }),
      );
      setCsv({ name: csvName, text: buildSampleCsv(ids) });
      setCsvError(null);
      setPickedFiles(files);
    } catch (err) {
      setSampleError(
        err instanceof Error
          ? `${err.message} Check your connection and try again.`
          : "Couldn't load the sample batch. Try again.",
      );
    } finally {
      setSampleProgress(null);
    }
  }

  async function run(targets: BatchRowInput[], images: Map<string, ImageSource>) {
    setRunning(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      await runBatch(targets, images, {
        signal: controller.signal,
        onState: (line, state) =>
          setRows((prev) =>
            prev.map((row) => (row.line === line ? { ...row, state } : row)),
          ),
      });
    } finally {
      setRunning(false);
    }
  }

  function start() {
    if (!preflightResult?.ok || running) return;
    const initial = preflightResult.rows.map((row) => ({ ...row, state: PENDING }));
    setRows(initial);
    setRunImages(collected.sources);
    setSelectedLine(null);
    setStage("run");
    void run(preflightResult.rows, collected.sources);
  }

  /** Re-run a subset (failed rows, remaining rows, or one row). */
  function rerun(targets: BatchRow[]) {
    if (running || targets.length === 0) return;
    const lines = new Set(targets.map((row) => row.line));
    setRows((prev) =>
      prev.map((row) => (lines.has(row.line) ? { ...row, state: PENDING } : row)),
    );
    void run(targets, runImages);
  }

  // --- Run stage ---
  if (stage === "run") {
    const selected = rows.find((row) => row.line === selectedLine);
    if (selected) {
      return (
        <RowDetailView
          row={selected}
          images={runImages}
          onBack={() => setSelectedLine(null)}
          onRetry={
            !running && selected.state.status === "error"
              ? () => rerun([selected])
              : undefined
          }
        />
      );
    }

    const failed = rows.filter((row) => row.state.status === "error");
    const remaining = rows.filter((row) => row.state.status === "pending");

    return (
      <div className="flex flex-col gap-5">
        <BatchProgress
          tallies={tally(rows.map((row) => row.state))}
          running={running}
          onCancel={() => abortRef.current?.abort()}
        />

        {!running && (
          <div className="flex flex-wrap items-center gap-3">
            {remaining.length > 0 && (
              <Button type="button" onClick={() => rerun(remaining)}>
                Check remaining {remaining.length} row{remaining.length === 1 ? "" : "s"}
              </Button>
            )}
            {failed.length > 0 && (
              <Button type="button" variant="outline" onClick={() => rerun(failed)}>
                Retry {failed.length} failed row{failed.length === 1 ? "" : "s"}
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                downloadCsv(exportResultsCsv(rows), "label-check-results.csv")
              }
            >
              Export results CSV
            </Button>
            <Button type="button" variant="outline" onClick={() => setStage("setup")}>
              Start a new batch
            </Button>
          </div>
        )}

        <ResultsTable rows={rows} onSelect={setSelectedLine} />
      </div>
    );
  }

  // --- Setup stage ---
  return (
    <div className="flex flex-col gap-6">
      <BatchSetup
        csvName={csv?.name ?? null}
        csvError={csvError}
        onCsvPicked={pickCsv}
        onCsvCleared={() => {
          setCsv(null);
          setCsvError(null);
        }}
        imageCount={collected.sources.size}
        ignored={collected.ignored}
        onImagesAdded={(files) => setPickedFiles((prev) => [...prev, ...files])}
        onImagesCleared={() => setPickedFiles([])}
        imagesError={imagesError}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-dashed bg-muted/40 px-3 py-2.5">
        <p className="text-sm text-muted-foreground">
          {sampleProgress
            ? `Fetching sample images (${sampleProgress.done}/${sampleProgress.total})…`
            : "No files handy? Load the sample batch that ships with the tool."}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {sampleProgress && <Spinner className="size-4" aria-hidden="true" />}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!!sampleProgress}
            onClick={() => loadSample(QUICK_BATCH_IDS, "sample-batch-quick.csv")}
          >
            {`Quick sample · ${QUICK_BATCH_IDS.length} labels`}
          </Button>
          {/* The full batch is ~95MB of original PNGs — fine off local disk,
              a 30–60s download from a deployed instance. Dev-only. */}
          {process.env.NODE_ENV === "development" && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!!sampleProgress}
              onClick={() =>
                loadSample(
                  DEMO_CASES.map((c) => c.application.application_id),
                  "sample-batch-full.csv",
                )
              }
            >
              {`Full sample · ${DEMO_CASES.length} labels`}
            </Button>
          )}
        </div>
      </div>
      {sampleError && <p className="text-sm text-destructive">{sampleError}</p>}

      {preflightResult ? (
        <PreflightReport result={preflightResult} onStart={start} />
      ) : (
        <p className="text-sm text-muted-foreground">
          Add the CSV and the label images — we&apos;ll check everything lines
          up before any label is processed.
        </p>
      )}
    </div>
  );
}
