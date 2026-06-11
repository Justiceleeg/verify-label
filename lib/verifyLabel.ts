// Client-side "verify one label": build the multipart request, POST
// /api/verify, map outcomes to a typed result, and retry transient failures
// once (ARCHITECTURE "Failure modes"). Single-label mode is a batch of one —
// Part 7's batch orchestrator calls this same module per row.

import type { ApplicationData, VerificationResult } from "@/core/types";
import { DownscaleError, downscaleImage } from "./downscale";

export type VerifyFailureKind =
  | "validation"
  | "too_large"
  | "rate_limited"
  | "extraction"
  | "network";

export type VerifyOutcome =
  | { ok: true; result: VerificationResult }
  | { ok: false; kind: VerifyFailureKind; message: string; retryable: boolean };

export interface VerifyOptions {
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
  /** Injectable wait (tests pass a spy instead of sleeping). */
  delay?: (ms: number) => Promise<void>;
  /** Called when a transient failure triggers the automatic retry. */
  onRetry?: (failure: Extract<VerifyOutcome, { ok: false }>) => void;
  /** Server-side consensus votes (1–3, default 1). The single-label form
   * sends 3 — parallel extractions with majority vote per field; batch rows
   * stay at 1 to keep per-row cost down. */
  votes?: number;
}

const DEFAULT_RETRY_AFTER_S = 5;

const FALLBACK_MESSAGES: Record<VerifyFailureKind, string> = {
  validation: "The application data was rejected. Check the fields and try again.",
  too_large: "An image is too large. Try a smaller photo.",
  rate_limited: "The service is busy. Wait a few seconds and try again.",
  extraction:
    "The label couldn't be processed. Try again; if it keeps failing, try a clearer photo.",
  network: "Couldn't reach the server. Check your connection and try again.",
};

function failureKind(status: number): VerifyFailureKind {
  if (status === 413) return "too_large";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "extraction";
  return "validation";
}

function isRetryable(kind: VerifyFailureKind): boolean {
  return kind === "rate_limited" || kind === "extraction" || kind === "network";
}

function failure(kind: VerifyFailureKind, message?: string): VerifyOutcome {
  return {
    ok: false,
    kind,
    message: message || FALLBACK_MESSAGES[kind],
    retryable: isRetryable(kind),
  };
}

async function attempt(
  body: FormData,
  opts: VerifyOptions,
): Promise<{ outcome: VerifyOutcome; retryAfterMs: number }> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl("/api/verify", {
      method: "POST",
      body,
      signal: opts.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    return { outcome: failure("network"), retryAfterMs: 0 };
  }

  if (response.ok) {
    try {
      return {
        outcome: { ok: true, result: (await response.json()) as VerificationResult },
        retryAfterMs: 0,
      };
    } catch {
      return {
        outcome: failure("network", "The server sent an unexpected response. Try again."),
        retryAfterMs: 0,
      };
    }
  }

  const kind = failureKind(response.status);
  let serverMessage: string | undefined;
  try {
    serverMessage = ((await response.json()) as { error?: string }).error;
  } catch {
    // non-JSON error body; fall back to the canned message
  }
  const retryAfterS = Number(response.headers.get("Retry-After"));
  return {
    outcome: failure(kind, serverMessage),
    retryAfterMs:
      kind === "rate_limited"
        ? (Number.isFinite(retryAfterS) && retryAfterS > 0
            ? retryAfterS
            : DEFAULT_RETRY_AFTER_S) * 1000
        : 0,
  };
}

/**
 * Verify one label: application data + already-downscaled image blobs
 * (front first — sourceImage index 0 = front). Retries once automatically
 * on transient failures (rate limit, upstream failure, network).
 */
export async function verifyLabel(
  app: ApplicationData,
  images: Blob[],
  opts: VerifyOptions = {},
): Promise<VerifyOutcome> {
  const body = new FormData();
  body.set("application", JSON.stringify(app));
  for (const image of images) {
    body.append("images", image, "label.jpg");
  }
  if (opts.votes !== undefined && opts.votes > 1) {
    body.set("votes", String(opts.votes));
  }

  const first = await attempt(body, opts);
  if (first.outcome.ok || !first.outcome.retryable) return first.outcome;

  opts.onRetry?.(first.outcome);
  if (first.retryAfterMs) {
    const delay =
      opts.delay ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
    await delay(first.retryAfterMs);
  }
  return (await attempt(body, opts)).outcome;
}

/**
 * Convenience for the form (and later, batch rows): downscale the picked
 * files, then verify. Order matters: front first, back second.
 */
export async function verifyLabelFiles(
  app: ApplicationData,
  files: File[],
  opts: VerifyOptions = {},
): Promise<VerifyOutcome> {
  let images: Blob[];
  try {
    images = await Promise.all(files.map(downscaleImage));
  } catch (err) {
    if (err instanceof DownscaleError) {
      return { ok: false, kind: "validation", message: err.message, retryable: false };
    }
    throw err;
  }
  return verifyLabel(app, images, opts);
}
