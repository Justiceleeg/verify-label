"use client";

// Verification results: overall banner, uploaded thumbnails, and one row per
// field — application value vs. label value, with the explanation always
// visible. The explanation is the product; values support it.

import { useEffect, useRef } from "react";
import type { LabelFields, VerificationResult, Verdict } from "@/core/types";
import { FIELD_LABELS } from "./fieldLabels";
import { useObjectUrl } from "./ImagePicker";
import { StatusBadge } from "./StatusBadge";

const OVERALL = {
  pass: {
    classes:
      "bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-200",
    title: () => "Everything matches",
  },
  needs_review: {
    classes:
      "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
    title: (n: number) =>
      `Needs your review — ${n} field${n === 1 ? "" : "s"} flagged`,
  },
  fail: {
    classes: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200",
    title: (n: number) =>
      `Problems found — ${n} field${n === 1 ? "" : "s"} need${n === 1 ? "s" : ""} attention`,
  },
} as const;

interface ResultsViewProps {
  result: VerificationResult;
  files: { front: File | null; back: File | null };
  onReset: () => void;
  onEdit: () => void;
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
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {heading}
      </p>
      {value === null ? (
        <p className="italic text-gray-500 dark:text-gray-400">
          {status === "unreadable" ? "Couldn't read" : "Not found on the label"}
        </p>
      ) : collapsible ? (
        <details>
          <summary className="cursor-pointer text-sm font-medium text-blue-700 dark:text-blue-400">
            Show full text
          </summary>
          <p className="mt-1 whitespace-pre-wrap text-sm">{value}</p>
        </details>
      ) : (
        <p className="break-words">{value}</p>
      )}
      {sourceNote && (
        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{sourceNote}</p>
      )}
    </div>
  );
}

export function ResultsView({ result, files, onReset, onEdit }: ResultsViewProps) {
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
        className={`rounded-lg p-4 text-lg font-semibold outline-none ${overall.classes}`}
      >
        {overall.title(flagged)}
      </div>

      <div className="flex gap-4">
        {frontUrl && (
          <figure>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={frontUrl} alt="Front label" className="h-32 rounded object-contain" />
            <figcaption className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Front label
            </figcaption>
          </figure>
        )}
        {backUrl && (
          <figure>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={backUrl} alt="Back label" className="h-32 rounded object-contain" />
            <figcaption className="mt-1 text-xs text-gray-500 dark:text-gray-400">
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
              className="rounded-lg border border-gray-200 p-4 dark:border-gray-800"
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
              <p className="mt-3 text-sm text-gray-700 dark:text-gray-300">
                {verdict.explanation}
              </p>
            </li>
          );
        })}
      </ul>

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
