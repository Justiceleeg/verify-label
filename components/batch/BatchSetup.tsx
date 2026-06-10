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
      className={`flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed p-4 text-center text-sm ${
        dragging
          ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
          : "border-gray-300 hover:border-gray-400 dark:border-gray-700 dark:hover:border-gray-500"
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
      <span className="font-medium text-blue-700 dark:text-blue-400">{prompt}</span>
      <span className="text-gray-500 dark:text-gray-400">{hint}</span>
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
        <span className="mb-1 block text-sm font-medium">Applications CSV</span>
        {csvName ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-300 p-3 dark:border-gray-700">
            <p className="min-w-0 truncate text-sm">{csvName}</p>
            <button
              type="button"
              onClick={onCsvCleared}
              disabled={disabled}
              className="text-sm font-medium text-blue-700 underline disabled:opacity-50 dark:text-blue-400"
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
          <p className="mt-1 text-sm text-red-700 dark:text-red-400">{csvError}</p>
        ) : (
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            One row per application, with an image_files column naming each
            row&apos;s label photos.
          </p>
        )}
      </div>

      <div>
        <span className="mb-1 block text-sm font-medium">Label images</span>
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
              className="font-medium text-blue-700 underline disabled:opacity-50 dark:text-blue-400"
            >
              Clear all
            </button>
          </p>
        )}
        {imagesError ? (
          <p className="mt-1 text-sm text-red-700 dark:text-red-400">{imagesError}</p>
        ) : ignored.length > 0 ? (
          <p className="mt-1 text-sm text-amber-700 dark:text-amber-400">
            {`Skipped ${ignored.length} file${ignored.length === 1 ? "" : "s"} that ` +
              `${ignored.length === 1 ? "isn't" : "aren't"} images: ` +
              `${ignored.slice(0, 3).join(", ")}${ignored.length > 3 ? "…" : ""}`}
          </p>
        ) : (
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Every photo the CSV mentions — front and back where you have both.
          </p>
        )}
      </div>
    </div>
  );
}
