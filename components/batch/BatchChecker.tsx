"use client";

// Batch container: setup (CSV + images → live pre-flight report) → run
// (orchestrator streams row states into the table) → drill-in per row.
// All state is client-side and session-only; closing the tab abandons the
// batch (accepted trade-off, ARCHITECTURE "Client-orchestrated batch").

import { useEffect, useMemo, useRef, useState } from "react";
import { exportResultsCsv } from "@/lib/batch/exportCsv";
import { collectImageSources, type ImageSource } from "@/lib/batch/imageSource";
import { preflight, type BatchRowInput } from "@/lib/batch/preflight";
import { runBatch, type BatchRow, type RowState } from "@/lib/batch/run";
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
    const secondaryButton =
      "rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium " +
      "hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900";

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
              <button
                type="button"
                onClick={() => rerun(remaining)}
                className="rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
              >
                Check remaining {remaining.length} row{remaining.length === 1 ? "" : "s"}
              </button>
            )}
            {failed.length > 0 && (
              <button
                type="button"
                onClick={() => rerun(failed)}
                className={secondaryButton}
              >
                Retry {failed.length} failed row{failed.length === 1 ? "" : "s"}
              </button>
            )}
            <button
              type="button"
              onClick={() =>
                downloadCsv(exportResultsCsv(rows), "label-check-results.csv")
              }
              className={secondaryButton}
            >
              Export results CSV
            </button>
            <button
              type="button"
              onClick={() => setStage("setup")}
              className={secondaryButton}
            >
              Start a new batch
            </button>
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

      {preflightResult ? (
        <PreflightReport result={preflightResult} onStart={start} />
      ) : (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Add the CSV and the label images — we&apos;ll check everything lines
          up before any label is processed.
        </p>
      )}
    </div>
  );
}
