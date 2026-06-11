"use client";

// Side-by-side review of one field verdict: the label image on the left,
// the field's application/label values and explanation on the right, so a
// reviewer can check the claim against the photo without scrolling between
// them. Prev/next (buttons or arrow keys) steps through every field, match
// rows included. Opens preselected on the image the value was read from.

import { ChevronLeftIcon, ChevronRightIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { LabelFields, VerificationResult, Verdict } from "@/core/types";
import { FIELD_LABELS } from "./fieldLabels";
import { ZoomableImage } from "./ImageLightbox";
import { StatusBadge } from "./StatusBadge";

interface FieldReviewDialogProps {
  result: VerificationResult;
  index: number;
  frontUrl: string | null;
  backUrl: string | null;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

type Side = "front" | "back";

/** The image the extractor read this field from; front when unknown. */
function defaultSide(result: VerificationResult, verdict: Verdict): Side {
  if (verdict.field === "same_field_of_vision") return "front";
  const source = result.extracted[verdict.field as keyof LabelFields]?.sourceImage;
  return source === 1 ? "back" : "front";
}

function ValueBlock({
  heading,
  value,
  status,
}: {
  heading: string;
  value: string | null;
  status: Verdict["status"];
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {heading}
      </p>
      {value === null ? (
        <p className="mt-0.5 italic text-muted-foreground">
          {status === "unreadable" ? "Couldn't read" : "Not found on the label"}
        </p>
      ) : (
        <p className="mt-0.5 break-words whitespace-pre-wrap">{value}</p>
      )}
    </div>
  );
}

export function FieldReviewDialog({
  result,
  index,
  frontUrl,
  backUrl,
  onClose,
  onNavigate,
}: FieldReviewDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const verdict = result.verdicts[index];
  // The image pane follows the field's source image as the reviewer steps
  // between fields; a manual front/back toggle only sticks for that field.
  const [override, setOverride] = useState<{ index: number; side: Side } | null>(null);
  const side = override?.index === index ? override.side : defaultSide(result, verdict);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  const showValues = verdict.field !== "same_field_of_vision";
  const bothImages = Boolean(frontUrl && backUrl);
  const shownUrl = side === "back" ? (backUrl ?? frontUrl) : (frontUrl ?? backUrl);
  const shownAlt =
    side === "back" && backUrl ? "Back label" : frontUrl ? "Front label" : "Back label";

  function navigate(delta: number) {
    const next = index + delta;
    if (next >= 0 && next < result.verdicts.length) onNavigate(next);
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      // Clicks on the ::backdrop are dispatched to the <dialog> itself.
      onClick={(e) => {
        if (e.target === e.currentTarget) e.currentTarget.close();
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") navigate(-1);
        if (e.key === "ArrowRight") navigate(1);
      }}
      className="m-auto w-[min(64rem,calc(100vw-2rem))] rounded-md border bg-card p-0 shadow-lg outline-none backdrop:bg-foreground/50"
    >
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h2 className="font-heading text-lg font-bold">
            {FIELD_LABELS[verdict.field]}
          </h2>
          <StatusBadge status={verdict.status} />
        </div>
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <XIcon className="size-5" aria-hidden="true" />
          <span className="sr-only">Close review</span>
        </button>
      </div>

      <div className="grid md:grid-cols-2">
        <div className="flex flex-col items-center gap-3 border-b bg-muted/30 p-4 md:border-r md:border-b-0">
          {bothImages && (
            <div className="flex gap-1 rounded-md border bg-card p-0.5">
              {(["front", "back"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setOverride({ index, side: option })}
                  className={`rounded-sm px-3 py-1 text-sm font-medium transition-colors ${
                    side === option
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {option === "front" ? "Front label" : "Back label"}
                </button>
              ))}
            </div>
          )}
          {shownUrl ? (
            <ZoomableImage
              src={shownUrl}
              alt={shownAlt}
              className="max-h-[55vh] w-full rounded-sm object-contain"
            />
          ) : (
            <p className="py-12 text-sm italic text-muted-foreground">
              Image not available
            </p>
          )}
        </div>

        <div className="flex flex-col gap-4 p-4">
          {showValues && (
            <>
              <ValueBlock
                heading="Application says"
                value={verdict.application_value}
                status={verdict.status}
              />
              <ValueBlock
                heading="Label says"
                value={verdict.label_value}
                status={verdict.status}
              />
            </>
          )}
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Why
            </p>
            <p className="mt-0.5 text-sm text-foreground/80">{verdict.explanation}</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between border-t px-4 py-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => navigate(-1)}
          disabled={index === 0}
        >
          <ChevronLeftIcon aria-hidden="true" />
          Previous field
        </Button>
        <p className="text-sm text-muted-foreground">
          {`${index + 1} of ${result.verdicts.length}`}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => navigate(1)}
          disabled={index === result.verdicts.length - 1}
        >
          Next field
          <ChevronRightIcon aria-hidden="true" />
        </Button>
      </div>
    </dialog>
  );
}
