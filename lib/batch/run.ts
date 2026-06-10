// Client batch orchestrator (ARCHITECTURE "Client-orchestrated batch"):
// a small worker pool drains the row list at bounded concurrency, reusing
// lib/verifyLabel per row (which downscales, POSTs, and retries transient
// failures once). Per-row isolation: one bad row never touches the others.

import type { ApplicationData, VerificationResult } from "@/core/types";
import {
  verifyLabelFiles,
  type VerifyFailureKind,
  type VerifyOptions,
  type VerifyOutcome,
} from "@/lib/verifyLabel";
import type { ImageSource } from "./imageSource";
import type { BatchRowInput } from "./preflight";

export const DEFAULT_CONCURRENCY = 8;

export type RowState =
  | { status: "pending" }
  | { status: "running"; retrying: boolean }
  | { status: "done"; result: VerificationResult }
  | { status: "error"; kind: VerifyFailureKind; message: string; retryable: boolean };

/** A row plus where it is in its lifecycle — what the batch UI renders. */
export interface BatchRow extends BatchRowInput {
  state: RowState;
}

export interface RunBatchOptions {
  concurrency?: number;
  /** Aborting resets in-flight rows to pending so they can be resumed. */
  signal?: AbortSignal;
  /** State transitions stream here, keyed by CSV line; the UI re-renders from them. */
  onState: (line: number, state: RowState) => void;
  /** Injectable for tests; defaults to the real verifyLabelFiles. */
  verify?: (
    app: ApplicationData,
    files: File[],
    opts: VerifyOptions,
  ) => Promise<VerifyOutcome>;
}

/**
 * Run every given row to a terminal state (done/error), or back to pending
 * if aborted mid-flight. Resolves when all rows have settled; never rejects
 * for row-level failures.
 */
export async function runBatch(
  rows: BatchRowInput[],
  images: Map<string, ImageSource>,
  options: RunBatchOptions,
): Promise<void> {
  const { signal, onState } = options;
  const verify = options.verify ?? verifyLabelFiles;
  const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;

  let cursor = 0;
  async function worker(): Promise<void> {
    while (cursor < rows.length) {
      if (signal?.aborted) return;
      const row = rows[cursor++];
      onState(row.line, { status: "running", retrying: false });

      let outcome: VerifyOutcome;
      try {
        // Files materialize here (lazy zip entries inflate now) and go out
        // of scope at the end of the iteration — peak memory stays at
        // ~`concurrency` decoded images regardless of batch size.
        const files = await Promise.all(
          row.imageNames.map((name) => {
            const source = images.get(name);
            if (!source) throw new Error(`Image "${name}" is no longer available.`);
            return source.getFile();
          }),
        );
        outcome = await verify(row.application, files, {
          signal,
          onRetry: () => onState(row.line, { status: "running", retrying: true }),
        });
      } catch (err) {
        if (signal?.aborted) {
          onState(row.line, { status: "pending" });
          return;
        }
        outcome = {
          ok: false,
          kind: "validation",
          message: err instanceof Error ? err.message : "Couldn't read this row's images.",
          retryable: false,
        };
      }

      onState(
        row.line,
        outcome.ok
          ? { status: "done", result: outcome.result }
          : {
              status: "error",
              kind: outcome.kind,
              message: outcome.message,
              retryable: outcome.retryable,
            },
      );
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, rows.length) }, worker),
  );
}
