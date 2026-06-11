"use client";

// One label's verification detail: overall banner, uploaded thumbnails, and
// a compact comparison table — one row per field: name, status, application
// value, label value. The explanation appears beneath the values only when
// a field is flagged; clean matches stay one line.
// When fields are flagged, the banner is a button that scrolls to the first
// problem and briefly pulses every flagged row. Every row opens a
// side-by-side review dialog (FieldReviewDialog) so the reviewer can check
// the values against the label image without scrolling between them.
// Shared by the single-label results screen and the batch row detail view.

import { SearchCheckIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { LabelFields, VerificationResult, Verdict, VerdictStatus } from "@/core/types";
import { FieldReviewDialog } from "./FieldReviewDialog";
import { FIELD_LABELS } from "./fieldLabels";
import { ZoomableImage } from "./ImageLightbox";
import { useObjectUrl } from "./ImagePicker";
import { StatusBadge } from "./StatusBadge";

const OVERALL = {
  pass: {
    classes: "border-success/30 bg-success/10 text-success",
    title: () => "Everything matches",
  },
  needs_review: {
    classes: "border-warning/40 bg-warning/10 text-warning",
    title: (n: number) =>
      `Needs your review — ${n} field${n === 1 ? "" : "s"} flagged`,
  },
  fail: {
    classes: "border-destructive/30 bg-destructive/10 text-destructive",
    title: (n: number) =>
      `Problems found — ${n} field${n === 1 ? "" : "s"} need${n === 1 ? "s" : ""} attention`,
  },
} as const;

/** Pulse tint per verdict, fed to the row-pulse keyframes via a CSS var. */
const PULSE_COLOR: Partial<Record<VerdictStatus, string>> = {
  probable_match: "var(--warning)",
  mismatch: "var(--destructive)",
  unreadable: "var(--muted-foreground)",
};

interface ResultDetailProps {
  result: VerificationResult;
  files: { front: File | null; back: File | null };
}

// Four columns: field name, status, application value, label value. Shared
// by the header strip and every row so they stay aligned (the status column
// is fixed-width — each row is its own grid, so auto would drift per row).
const ROW_GRID = "sm:grid-cols-[minmax(6.5rem,9rem)_8.5rem_1fr_1fr]";

function ValueCell({
  heading,
  value,
  status,
  condensed,
  sourceNote,
}: {
  heading: string;
  value: string | null;
  status: Verdict["status"];
  /** Long text (the government warning) stays out of the table — the row's
   *  review dialog shows it in full. */
  condensed: boolean;
  sourceNote?: string;
}) {
  return (
    <div className="min-w-0">
      {/* On wide screens the table header strip names the columns. */}
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground sm:hidden">
        {heading}
      </p>
      {value === null ? (
        <p className="italic text-muted-foreground">
          {status === "unreadable" ? "Couldn't read" : "Not found on the label"}
        </p>
      ) : condensed ? (
        <p className="text-sm italic text-muted-foreground">Click to expand</p>
      ) : (
        <p className="break-words">{value}</p>
      )}
      {sourceNote && (
        <p className="mt-0.5 text-xs text-muted-foreground">{sourceNote}</p>
      )}
    </div>
  );
}

export function ResultDetail({ result, files }: ResultDetailProps) {
  const bannerRef = useRef<HTMLDivElement>(null);
  const firstFlaggedRef = useRef<HTMLLIElement>(null);
  const [pulsing, setPulsing] = useState(false);
  const [reviewIndex, setReviewIndex] = useState<number | null>(null);
  const frontUrl = useObjectUrl(files.front);
  const backUrl = useObjectUrl(files.back);
  const twoImages = Boolean(files.front && files.back);

  useEffect(() => {
    bannerRef.current?.focus();
  }, []);

  const flagged = result.verdicts.filter((v) => v.status !== "match").length;
  const firstFlagged = result.verdicts.findIndex((v) => v.status !== "match");
  const overall = OVERALL[result.overall];

  function highlightProblems() {
    firstFlaggedRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    // Drop the class for a frame so a second click restarts the animation.
    setPulsing(false);
    requestAnimationFrame(() => setPulsing(true));
  }

  function sourceNote(verdict: Verdict): string | undefined {
    if (!twoImages || verdict.field === "same_field_of_vision") return undefined;
    const source = result.extracted[verdict.field as keyof LabelFields]?.sourceImage;
    if (source === 0) return "Read from the front label";
    if (source === 1) return "Read from the back label";
    return undefined;
  }

  return (
    <div className="flex flex-col gap-6">
      <div
        ref={bannerRef}
        tabIndex={-1}
        role="status"
        className={`rounded-md border outline-none ${overall.classes}`}
      >
        {flagged > 0 ? (
          <button
            type="button"
            onClick={highlightProblems}
            className="flex w-full cursor-pointer flex-wrap items-baseline justify-between gap-x-4 gap-y-1 p-4 text-left"
          >
            <span className="font-heading text-lg font-bold">
              {overall.title(flagged)}
            </span>
            <span className="text-sm opacity-80">
              Click to highlight the flagged fields
            </span>
          </button>
        ) : (
          <p className="p-4 font-heading text-lg font-bold">
            {overall.title(flagged)}
          </p>
        )}
      </div>

      <div className="flex gap-4">
        {frontUrl && (
          <figure>
            <ZoomableImage
              src={frontUrl}
              alt="Front label"
              className="h-32 rounded-sm object-contain"
            />
            <figcaption className="mt-1 text-xs text-muted-foreground">
              Front label
            </figcaption>
          </figure>
        )}
        {backUrl && (
          <figure>
            <ZoomableImage
              src={backUrl}
              alt="Back label"
              className="h-32 rounded-sm object-contain"
            />
            <figcaption className="mt-1 text-xs text-muted-foreground">
              Back label
            </figcaption>
          </figure>
        )}
      </div>

      <div className="overflow-hidden rounded-md border bg-card shadow-xs">
        <div
          aria-hidden="true"
          className={`hidden gap-x-4 border-b bg-muted/40 px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground sm:grid ${ROW_GRID}`}
        >
          <span>Field</span>
          <span>Status</span>
          <span>Application says</span>
          <span>Label says</span>
        </div>
        <ul className="divide-y">
          {result.verdicts.map((verdict, index) => {
            const condensed = verdict.field === "government_warning";
            // The same-field-of-vision check is about placement, not values —
            // its verdict carries no application/label text worth a cell.
            const showValues = verdict.field !== "same_field_of_vision";
            const isFlagged = verdict.status !== "match";
            return (
              <li
                key={verdict.field}
                ref={index === firstFlagged ? firstFlaggedRef : undefined}
                onAnimationEnd={() => setPulsing(false)}
                onClick={(e) => {
                  // Inner controls keep their own behavior; anywhere else on
                  // the row opens the review dialog.
                  if ((e.target as HTMLElement).closest("button, a")) return;
                  setReviewIndex(index);
                }}
                style={
                  isFlagged
                    ? ({ "--row-pulse-color": PULSE_COLOR[verdict.status] } as React.CSSProperties)
                    : undefined
                }
                className={`group cursor-pointer px-4 py-2.5 transition-colors hover:bg-muted/40 ${pulsing && isFlagged ? "row-pulse" : ""}`}
              >
                <div className={`grid gap-x-4 gap-y-2 ${ROW_GRID}`}>
                  {/* The icon rides inline after the last word so it hugs the
                      name even when it wraps; revealed on row hover/focus. */}
                  <span className="font-semibold">
                    {FIELD_LABELS[verdict.field]}
                    <button
                      type="button"
                      onClick={() => setReviewIndex(index)}
                      title="Review against the label"
                      className="ml-1.5 inline-flex align-middle text-muted-foreground opacity-0 transition-opacity hover:text-primary focus-visible:opacity-100 group-hover:opacity-100"
                    >
                      <SearchCheckIcon className="size-4" aria-hidden="true" />
                      <span className="sr-only">Review against the label</span>
                    </button>
                  </span>
                  <div>
                    <StatusBadge status={verdict.status} />
                  </div>
                  {showValues && (
                    <>
                      <ValueCell
                        heading="Application says"
                        value={verdict.application_value}
                        status={verdict.status}
                        condensed={condensed && verdict.application_value !== null}
                      />
                      <ValueCell
                        heading="Label says"
                        value={verdict.label_value}
                        status={verdict.status}
                        condensed={condensed && verdict.label_value !== null}
                        sourceNote={sourceNote(verdict)}
                      />
                    </>
                  )}
                  {isFlagged && (
                    <p className="text-sm text-foreground/80 sm:col-span-2 sm:col-start-3">
                      {verdict.explanation}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {reviewIndex !== null && (
        <FieldReviewDialog
          result={result}
          index={reviewIndex}
          frontUrl={frontUrl}
          backUrl={backUrl}
          onClose={() => setReviewIndex(null)}
          onNavigate={setReviewIndex}
        />
      )}
    </div>
  );
}
