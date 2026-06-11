"use client";

// Reference for the applications CSV: every required column, what goes in
// it, and a downloadable starter template. Opened from the CSV slot in
// BatchSetup so an agent can check the expected shape without leaving the
// page. The column list and limits come straight from the pre-flight
// validator, so this can't drift from what actually gets enforced.

import { DownloadIcon, XIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BEVERAGE_TYPES } from "@/core/application";
import { MAX_IMAGES_PER_ROW, REQUIRED_COLUMNS } from "@/lib/batch/preflight";

// Typed against REQUIRED_COLUMNS so adding/renaming a column there is a
// compile error here until the docs are updated to match.
const COLUMN_DOCS: Record<
  (typeof REQUIRED_COLUMNS)[number],
  { example: string; description: string }
> = {
  application_id: {
    example: "APP-2024-0001",
    description:
      "Your identifier for the application. Shown in the results table and the exported results CSV.",
  },
  beverage_type: {
    example: "spirits",
    description: `One of ${BEVERAGE_TYPES.join(", ")}.`,
  },
  brand_name: {
    example: "Old Tom Reserve",
    description: "Brand name exactly as stated on the application.",
  },
  class_type: {
    example: "Kentucky Straight Bourbon Whiskey",
    description: "Class/type designation from the application.",
  },
  abv: {
    example: "45",
    description:
      "Alcohol by volume as a number between 0 and 100, e.g. 45 or 45.5. A trailing % is fine.",
  },
  net_contents: {
    example: "750 mL",
    description: "Net contents as stated on the application.",
  },
  image_files: {
    example: "app-0001-front.png;app-0001-back.png",
    description:
      `This row's label photos, separated by semicolons — front first, ` +
      `back second, ${MAX_IMAGES_PER_ROW} at most. Each name must exactly match an ` +
      "uploaded image filename (case-sensitive).",
  },
};

const TEMPLATE_CSV = [
  REQUIRED_COLUMNS.join(","),
  "APP-2024-0001,spirits,Old Tom Reserve,Kentucky Straight Bourbon Whiskey,45,750 mL,app-0001-front.png;app-0001-back.png",
  "APP-2024-0002,wine,Willow Creek Cellars,Cabernet Sauvignon,13.5,750 mL,app-0002-front.png",
].join("\n");

function downloadTemplate() {
  const url = URL.createObjectURL(new Blob([TEMPLATE_CSV], { type: "text/csv" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "applications-template.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

export function CsvFormatDialog({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      // Clicks on the ::backdrop are dispatched to the <dialog> itself.
      onClick={(e) => {
        if (e.target === e.currentTarget) e.currentTarget.close();
      }}
      className="m-auto w-[min(48rem,calc(100vw-2rem))] rounded-md border bg-card p-0 shadow-lg outline-none backdrop:bg-foreground/50"
    >
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <h2 className="font-heading text-lg font-bold">Applications CSV format</h2>
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <XIcon className="size-5" aria-hidden="true" />
          <span className="sr-only">Close CSV format reference</span>
        </button>
      </div>

      <div className="flex flex-col gap-4 p-4">
        <p className="text-sm text-muted-foreground">
          One row per application, with a header row naming every column below.
          Extra columns are fine — they&apos;re ignored. Problems are reported
          per row before anything is processed.
        </p>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Column</TableHead>
              <TableHead>What goes in it</TableHead>
              <TableHead>Example</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {REQUIRED_COLUMNS.map((column) => (
              <TableRow key={column}>
                <TableCell className="align-top font-mono text-xs">
                  {column}
                </TableCell>
                <TableCell className="whitespace-normal align-top text-sm">
                  {COLUMN_DOCS[column].description}
                </TableCell>
                <TableCell className="align-top font-mono text-xs text-muted-foreground">
                  {COLUMN_DOCS[column].example}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <pre className="overflow-x-auto rounded-md border bg-muted/40 p-3 text-xs leading-relaxed">
          {TEMPLATE_CSV}
        </pre>
      </div>

      <div className="flex items-center justify-between gap-3 border-t px-4 py-3">
        <Button type="button" variant="outline" size="sm" onClick={downloadTemplate}>
          <DownloadIcon aria-hidden="true" />
          Download template
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => dialogRef.current?.close()}
        >
          Close
        </Button>
      </div>
    </dialog>
  );
}
