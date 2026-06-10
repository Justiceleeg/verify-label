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
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {file ? (
        <div className="flex items-center gap-4 rounded-lg border border-gray-300 p-3 dark:border-gray-700">
          {previewUrl && (
            // Session-only blob preview; next/image adds nothing for object URLs.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt={`${label} preview`}
              className="h-24 w-24 rounded object-contain"
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm">{file.name}</p>
            <button
              type="button"
              onClick={remove}
              disabled={disabled}
              className="mt-1 text-sm font-medium text-blue-700 underline disabled:opacity-50 dark:text-blue-400"
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
          className={`flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed p-4 text-center text-sm ${
            dragging
              ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
              : "border-gray-300 hover:border-gray-400 dark:border-gray-700 dark:hover:border-gray-500"
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
          <span className="font-medium text-blue-700 dark:text-blue-400">
            Choose a photo
          </span>
          <span className="text-gray-500 dark:text-gray-400">
            or drag one here
          </span>
        </label>
      )}
      {helper && !message && (
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{helper}</p>
      )}
      {message && (
        <p id={errorId} className="mt-1 text-sm text-red-700 dark:text-red-400">
          {message}
        </p>
      )}
    </div>
  );
}
