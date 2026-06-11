// POST /api/verify — multipart parse → validate → extract → compare.
// Built as a factory so tests inject a stub extractor and a fixed clock;
// route.ts instantiates it with the real defaults. Request/response contract:
// docs/ARCHITECTURE.md "API".

import { parseApplication } from "@/core/application";
import { compare } from "@/core/compare";
import {
  createConsensusExtractor,
  createDefaultExtractor,
  ExtractionError,
  type Extractor,
  type LabelImage,
} from "@/core/extractor";
import { createTokenBucketLimiter, type RateLimiter } from "./rateLimit";

const ALLOWED_IMAGE_TYPES = new Set<string>([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]) as ReadonlySet<string>;

export const MAX_IMAGES = 2;
/** Cap on per-request consensus votes — every vote is a full model call,
 * so this bounds the upstream cost any one request can trigger. */
export const MAX_VOTES = 3;
/** Per image. The client downscales to ~200–400KB; Vercel caps the whole
 * body at ~4.5MB regardless, so this just produces the better error. */
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

export interface VerifyHandlerDeps {
  extractor?: Extractor;
  rateLimiter?: RateLimiter;
}

function error(status: number, message: string, headers?: HeadersInit): Response {
  return Response.json({ error: message }, { status, headers });
}

function clientIp(request: Request): string {
  // First hop of x-forwarded-for; Vercel sets it from the connecting client.
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

export function createVerifyHandler(deps: VerifyHandlerDeps = {}) {
  // Lazy: the default extractor constructs an API client that requires
  // OPENAI_API_KEY, which must not be needed just to load the module
  // (next build evaluates route files).
  let extractor = deps.extractor;
  const rateLimiter = deps.rateLimiter ?? createTokenBucketLimiter();

  return async function handleVerify(request: Request): Promise<Response> {
    if (!rateLimiter.allow(clientIp(request))) {
      return error(
        429,
        "Too many requests from this address. Wait a few seconds and retry.",
        { "Retry-After": "5" },
      );
    }

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return error(
        400,
        'Expected multipart/form-data with an "application" JSON field and 1–2 "images" files.',
      );
    }

    const rawApplication = form.get("application");
    if (typeof rawApplication !== "string") {
      return error(400, 'Missing "application" form field (a JSON object).');
    }
    let applicationJson: unknown;
    try {
      applicationJson = JSON.parse(rawApplication);
    } catch {
      return error(400, 'The "application" field is not valid JSON.');
    }
    const parsed = parseApplication(applicationJson);
    if (!parsed.ok) {
      return error(400, `Invalid application data: ${parsed.errors.join(" ")}`);
    }

    const files = form.getAll("images").filter((entry) => entry instanceof File);
    if (files.length < 1) {
      return error(400, 'Attach at least one label image as an "images" file.');
    }
    if (files.length > MAX_IMAGES) {
      return error(
        400,
        `At most ${MAX_IMAGES} label images (front and back) per request; got ${files.length}.`,
      );
    }
    for (const file of files) {
      if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
        return error(
          400,
          `Unsupported image type "${file.type || "unknown"}" for "${file.name}" — use PNG, JPEG, WebP, or GIF.`,
        );
      }
      if (file.size === 0) {
        return error(400, `Image "${file.name}" is empty. Re-attach the file.`);
      }
      if (file.size > MAX_IMAGE_BYTES) {
        return error(
          413,
          `Image "${file.name}" is ${(file.size / 1024 / 1024).toFixed(1)}MB — the limit is ${MAX_IMAGE_BYTES / 1024 / 1024}MB per image. Downscale it and retry.`,
        );
      }
    }

    // Optional N-way consensus (core/extractor/consensus.ts): the single-label
    // form sends 3 — parallel votes cancel small-model flakiness on an
    // interactive check; the batch client omits it to keep per-row cost at 1×.
    const rawVotes = form.get("votes");
    let votes = 1;
    if (rawVotes !== null) {
      votes = typeof rawVotes === "string" ? Number(rawVotes) : NaN;
      if (!Number.isInteger(votes) || votes < 1 || votes > MAX_VOTES) {
        return error(400, `The "votes" field must be an integer from 1 to ${MAX_VOTES}.`);
      }
    }

    const images: LabelImage[] = await Promise.all(
      files.map(async (file) => ({
        data: Buffer.from(await file.arrayBuffer()).toString("base64"),
        mediaType: file.type as LabelImage["mediaType"],
      })),
    );

    try {
      extractor ??= createDefaultExtractor();
      // votes === 1 returns the base extractor unwrapped — no overhead.
      const extracted = await createConsensusExtractor(extractor, votes).extract(
        images,
        parsed.data.beverage_type,
      );
      return Response.json(compare(parsed.data, extracted));
    } catch (err) {
      if (err instanceof ExtractionError) {
        return error(502, `Label extraction failed: ${err.message}`);
      }
      console.error("verify: extraction failed", err);
      return error(
        502,
        "The vision service failed for this label. Retry the row; if it keeps failing, the image may be the problem.",
      );
    }
  };
}
