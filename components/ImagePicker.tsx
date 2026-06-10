"use client";

// One image slot (front or back label): a large click-to-browse target that
// also accepts drag-and-drop, with a thumbnail preview once a file is picked.

import { useEffect, useId, useMemo, useRef, useState } from "react";

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

/** Object URL for a File, revoked automatically when it changes/unmounts. */
export function useObjectUrl(file: File | null): string | null {
  const url = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);
  return url;
}

interface ImagePickerProps {
  label: string;
  helper?: string;
  file: File | null;
  onChange: (file: File | null) => void;
  disabled?: boolean;
  error?: string;
}

export function ImagePicker({
  label,
  helper,
  file,
  onChange,
  disabled,
  error,
}: ImagePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const errorId = useId();
  const [dragging, setDragging] = useState(false);
  const [dropError, setDropError] = useState<string | null>(null);
  const previewUrl = useObjectUrl(file);
  const message = error ?? dropError;

  function pick(selected: File | undefined) {
    if (!selected) return;
    if (!ACCEPTED_TYPES.includes(selected.type)) {
      setDropError("That file isn't a supported image — use PNG, JPEG, WebP, or GIF.");
      return;
    }
    setDropError(null);
    onChange(selected);
  }

  function remove() {
    if (inputRef.current) inputRef.current.value = "";
    setDropError(null);
    onChange(null);
  }

  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {file ? (
        <div className="flex items-center gap-4 rounded-md border bg-card p-3">
          {previewUrl && (
            // Session-only blob preview; next/image adds nothing for object URLs.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt={`${label} preview`}
              className="h-24 w-24 rounded-sm object-contain"
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm">{file.name}</p>
            <button
              type="button"
              onClick={remove}
              disabled={disabled}
              className="mt-1 text-sm font-medium text-primary underline underline-offset-4 hover:text-primary/80 disabled:opacity-50"
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <label
          onDragOver={(e) => {
            e.preventDefault();
            if (!disabled) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (!disabled) pick(e.dataTransfer.files[0]);
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
            accept={ACCEPTED_TYPES.join(",")}
            onChange={(e) => pick(e.target.files?.[0])}
            disabled={disabled}
            className="sr-only"
            aria-invalid={message ? true : undefined}
            aria-describedby={message ? errorId : undefined}
          />
          <span className="font-medium text-primary">Choose a photo</span>
          <span className="text-muted-foreground">or drag one here</span>
        </label>
      )}
      {helper && !message && (
        <p className="mt-1.5 text-sm text-muted-foreground">{helper}</p>
      )}
      {message && (
        <p id={errorId} className="mt-1.5 text-sm text-destructive">
          {message}
        </p>
      )}
    </div>
  );
}
