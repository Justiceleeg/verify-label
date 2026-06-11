"use client";

// Click-to-enlarge wrapper for label images. The thumbnail is a button that
// opens the full-size image in a native <dialog> modal — Esc, the close
// button, and a backdrop click all dismiss it. Use this anywhere a label
// image appears so previews behave the same across the app.

import { XIcon, ZoomInIcon } from "lucide-react";
import { useRef } from "react";

export function ZoomableImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  /** Classes for the thumbnail <img>. */
  className?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        title="Click to enlarge"
        className="group relative block cursor-zoom-in rounded-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        {/* Session-only blob preview; next/image adds nothing for object URLs. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className={className} />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-1 bottom-1 rounded-sm bg-foreground/60 p-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
        >
          <ZoomInIcon className="size-3.5 text-background" />
        </span>
        <span className="sr-only">{`Enlarge ${alt.toLowerCase()}`}</span>
      </button>

      <dialog
        ref={dialogRef}
        // Clicks on the ::backdrop are dispatched to the <dialog> itself;
        // clicks on the figure inside never match currentTarget.
        onClick={(e) => {
          if (e.target === e.currentTarget) e.currentTarget.close();
        }}
        className="m-auto bg-transparent p-4 outline-none backdrop:bg-foreground/85"
      >
        <figure className="flex flex-col items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            className="max-h-[85vh] max-w-[90vw] rounded-sm object-contain"
          />
          <figcaption className="text-sm text-background">{alt}</figcaption>
        </figure>
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          className="absolute top-2 right-2 rounded-md bg-foreground/60 p-1.5 text-background transition-colors hover:bg-foreground"
        >
          <XIcon className="size-5" aria-hidden="true" />
          <span className="sr-only">Close preview</span>
        </button>
      </dialog>
    </>
  );
}
