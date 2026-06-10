"use client";

// One label's verification detail: overall banner, uploaded thumbnails, and
// one row per field — application value vs. label value, with the explanation
// always visible. The explanation is the product; values support it.
// Shared by the single-label results screen and the batch row detail view.

import { useEffect, useRef } from "react";
import type { LabelFields, VerificationResult, Verdict } from "@/core/types";
import { FIELD_LABELS } from "./fieldLabels";
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

interface ResultDetailProps {
  result: VerificationResult;
  files: { front: File | null; back: File | null };
}

function ValueCell({
  heading,
  value,
  status,
  collapsible,
  sourceNote,
}: {
  heading: string;
  value: string | null;
  status: Verdict["status"];
  collapsible: boolean;
  sourceNote?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {heading}
      </p>
      {value === null ? (
        <p className="italic text-muted-foreground">
          {status === "unreadable" ? "Couldn't read" : "Not found on the label"}
        </p>
      ) : collapsible ? (
        <details>
          <summary className="cursor-pointer text-sm font-medium text-primary">
            Show full text
          </summary>
          <p className="mt-1 whitespace-pre-wrap text-sm">{value}</p>
        </details>
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
  const frontUrl = useObjectUrl(files.front);
  const backUrl = useObjectUrl(files.back);
  const twoImages = Boolean(files.front && files.back);

  useEffect(() => {
    bannerRef.current?.focus();
  }, []);

  const flagged = result.verdicts.filter((v) => v.status !== "match").length;
  const overall = OVERALL[result.overall];

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
        className={`rounded-md border p-4 font-heading text-lg font-bold outline-none ${overall.classes}`}
      >
        {overall.title(flagged)}
      </div>

      <div className="flex gap-4">
        {frontUrl && (
          <figure>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={frontUrl} alt="Front label" className="h-32 rounded-sm object-contain" />
            <figcaption className="mt-1 text-xs text-muted-foreground">
              Front label
            </figcaption>
          </figure>
        )}
        {backUrl && (
          <figure>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={backUrl} alt="Back label" className="h-32 rounded-sm object-contain" />
            <figcaption className="mt-1 text-xs text-muted-foreground">
              Back label
            </figcaption>
          </figure>
        )}
      </div>

      <ul className="flex flex-col gap-3">
        {result.verdicts.map((verdict) => {
          const collapsible = verdict.field === "government_warning";
          // The same-field-of-vision check is about placement, not values —
          // its verdict carries no application/label text worth a cell.
          const showValues = verdict.field !== "same_field_of_vision";
          return (
            <li
              key={verdict.field}
              className="rounded-md border bg-card p-4 shadow-xs"
            >
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <StatusBadge status={verdict.status} />
                <span className="font-semibold">{FIELD_LABELS[verdict.field]}</span>
              </div>
              {showValues && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <ValueCell
                    heading="Application says"
                    value={verdict.application_value}
                    status={verdict.status}
                    collapsible={collapsible && verdict.application_value !== null}
                  />
                  <ValueCell
                    heading="Label says"
                    value={verdict.label_value}
                    status={verdict.status}
                    collapsible={collapsible && verdict.label_value !== null}
                    sourceNote={sourceNote(verdict)}
                  />
                </div>
              )}
              <p className="mt-3 text-sm text-foreground/80">
                {verdict.explanation}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
