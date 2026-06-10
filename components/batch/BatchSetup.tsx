"use client";

// Batch inputs: the applications CSV and the label images (multi-select
// and/or zips). Image picks are additive so an agent can drop a zip, notice
// a missing file in the pre-flight report, and add just that one image.

import { useRef, useState } from "react";

function Dropzone({
  onFiles,
  disabled,
  accept,
  multiple,
  prompt,
  hint,
}: {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
  accept: string;
  multiple?: boolean;
  prompt: string;
  hint: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function handle(list: FileList | null) {
    const files = [...(list ?? [])];
    if (files.length > 0) onFiles(files);
    // Allow re-picking the same file after a Clear.
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <label
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (!disabled) handle(e.dataTransfer.files);
      }}
      className={`flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed p-4 text-center text-sm transition-colors ${
        dragging
          ? "border-ring bg-accent"
          : "border-input hover:border-ring/60 hover:bg-muted/50"
      } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={(e) => handle(e.target.files)}
        disabled={disabled}
        className="sr-only"
      />
      <span className="font-medium text-primary">{prompt}</span>
      <span className="text-muted-foreground">{hint}</span>
    </label>
  );
}

interface BatchSetupProps {
  csvName: string | null;
  /** Wrong file type / unreadable file — shown under the CSV slot. */
  csvError: string | null;
  onCsvPicked: (file: File) => void;
  onCsvCleared: () => void;
  imageCount: number;
  /** Picked files that were neither images nor zips. */
  ignored: string[];
  onImagesAdded: (files: File[]) => void;
  onImagesCleared: () => void;
  /** Unreadable zip, unreadable CSV file, … — shown under the relevant slot. */
  imagesError: string | null;
  disabled?: boolean;
}

export function BatchSetup({
  csvName,
  csvError,
  onCsvPicked,
  onCsvCleared,
  imageCount,
  ignored,
  onImagesAdded,
  onImagesCleared,
  imagesError,
  disabled,
}: BatchSetupProps) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <div>
        <span className="mb-1.5 block text-sm font-medium">Applications CSV</span>
        {csvName ? (
          <div className="flex items-center justify-between gap-3 rounded-md border bg-card p-3">
            <p className="min-w-0 truncate text-sm">{csvName}</p>
            <button
              type="button"
              onClick={onCsvCleared}
              disabled={disabled}
              className="text-sm font-medium text-primary underline underline-offset-4 hover:text-primary/80 disabled:opacity-50"
            >
              Remove
            </button>
          </div>
        ) : (
          <Dropzone
            accept=".csv,text/csv"
            onFiles={(files) => onCsvPicked(files[0])}
            disabled={disabled}
            prompt="Choose the CSV"
            hint="or drag it here"
          />
        )}
        {csvError ? (
          <p className="mt-1.5 text-sm text-destructive">{csvError}</p>
        ) : (
          <p className="mt-1.5 text-sm text-muted-foreground">
            One row per application, with an image_files column naming each
            row&apos;s label photos.
          </p>
        )}
      </div>

      <div>
        <span className="mb-1.5 block text-sm font-medium">Label images</span>
        <Dropzone
          accept="image/*,.zip,application/zip"
          multiple
          onFiles={onImagesAdded}
          disabled={disabled}
          prompt={imageCount > 0 ? "Add more images" : "Choose images or a zip"}
          hint="or drag them here — you can select many at once"
        />
        {imageCount > 0 && (
          <p className="mt-1 text-sm">
            {imageCount} image{imageCount === 1 ? "" : "s"} ready ·{" "}
            <button
              type="button"
              onClick={onImagesCleared}
              disabled={disabled}
              className="font-medium text-primary underline underline-offset-4 hover:text-primary/80 disabled:opacity-50"
            >
              Clear all
            </button>
          </p>
        )}
        {imagesError ? (
          <p className="mt-1.5 text-sm text-destructive">{imagesError}</p>
        ) : ignored.length > 0 ? (
          <p className="mt-1.5 text-sm text-warning">
            {`Skipped ${ignored.length} file${ignored.length === 1 ? "" : "s"} that ` +
              `${ignored.length === 1 ? "isn't" : "aren't"} images: ` +
              `${ignored.slice(0, 3).join(", ")}${ignored.length > 3 ? "…" : ""}`}
          </p>
        ) : (
          <p className="mt-1.5 text-sm text-muted-foreground">
            Every photo the CSV mentions — front and back where you have both.
          </p>
        )}
      </div>
    </div>
  );
}
