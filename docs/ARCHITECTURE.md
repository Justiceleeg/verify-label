# Architecture

Companion to [PRD.md](PRD.md). Describes the technical design of the
prototype; the PRD owns requirements and scope.

## Overview

Next.js full-stack app, deployed on Vercel. Stateless backend: one
verification endpoint, nothing persisted. Batch processing is orchestrated by
the client, so there is no job queue, no websockets, and no object storage.

```
┌─────────────────────────── Browser (client) ───────────────────────────┐
│  Single-label form ──┐                                                  │
│  CSV upload (PapaParse) ─┤→ orchestrator: per-label jobs, concurrency 8 │
│  Zip → images (fflate)  ─┘   ├─ canvas downscale (~1500px, <4.5MB)      │
│  Progress UI / results table ◄─ verdicts return per row                 │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ POST /api/verify  (one label per request:
                                │  application fields + image(s))
┌───────────────────────────────▼─────────────────────────────────────────┐
│                    Next.js API route (stateless)                        │
│   ┌─ core/ (pure TS, no framework imports, unit-tested) ─────────────┐  │
│   │  extractor/  Extractor interface → claude.ts (vision, tool-use)   │  │
│   │  rules/      beverage-type config, §16.21 warning text constant   │  │
│   │  compare/    normalize → match → per-field Verdict[]              │  │
│   └────────────────────────────────────────────────────────────────────┘ │
│   image lives in request memory only — never written anywhere           │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ base64 image + extraction schema
                                ▼
                      Anthropic API (Claude vision)
                      [the single egress endpoint]
```

## Repo layout

```
core/
  types.ts        ApplicationData, LabelFields, Verdict — shared end-to-end
  extractor/      Extractor interface + claude.ts implementation
  compare/        normalization + per-field matchers + verdict derivation
  rules/          beverage-type rules, government warning constant
app/              Next.js App Router pages + api/verify route
components/       upload, batch progress, results table, detail view
fixtures/         sample CSV, test label images, expected verdicts
```

`core/` is the substantive codebase: pure TypeScript, zero Next.js imports,
covered by Vitest against `fixtures/` (including the seeded-error batch from
the PRD). The web app is a thin shell around it.

## Client-orchestrated batch

The browser owns the batch loop:

1. Images arrive via multi-select / drag-and-drop (primary — `File` objects
   are lazy references, so selecting 300 files costs nothing) or a zip
   (convenience; entries extracted lazily with fflate, never all at once).
   CSV parsed with PapaParse.
2. Pre-flight validation — missing columns, rows referencing absent images,
   orphan images — before any API call.
3. Downscale each image via canvas to ~1500px longest edge (stays under
   Vercel's ~4.5MB body limit; cuts vision tokens, cost, and latency).
4. Fire `POST /api/verify` per application at bounded concurrency (~8).
   300 labels ≈ 3 minutes.
5. Render live progress (n/total, ✅/⚠️/❌/❓ tallies); per-row isolation and
   retry; export results CSV.

Single-label mode is a batch of one fed by a form. One pipeline.

Trade-off, accepted for the prototype: closing the tab abandons an in-flight
batch. Acceptable with no auth and session-only state; a server-side queue is
the v2 answer if persistence is ever required.

### Memory discipline

Decode only in-flight images. Per-label lifecycle: read `File` →
`createImageBitmap` → canvas downscale → `toBlob('image/jpeg', 0.8)`
(~200–400KB) → POST → release (close bitmap, drop references). Peak memory is
~8 decoded images (~50–100MB transient), independent of batch size. Results
state holds only verdict JSON; thumbnails use `URL.createObjectURL` (revoked
on unmount).

### Transfer profile (no streaming anywhere)

Every hop is a small one-shot request; Next.js streaming limitations are
irrelevant by construction:

- Browser → API route: one multipart POST per label (~200–400KB downscaled
  JPEG), `await request.formData()`. The downscale is what keeps phone photos
  under the 4.5MB body cap.
- API route → Anthropic: image as base64 in the JSON body (~+33%). Input
  images cannot be streamed to the API; irrelevant at this size.
- Response: small structured JSON (a few hundred tokens) — plain
  non-streaming call.

At concurrency 8 only ~3MB is in flight at any moment. Vercel serves HTTP/2
(multiplexed, no per-host connection ceiling) and each request is its own
serverless invocation, so there is no server-side pile-up. The only real
constraint is the user's upstream bandwidth (~120MB over ~3 min ≈ 5–6 Mbps);
a slow connection stretches the batch but never breaks it.

### Failure modes

- **Per-row failure** (bad image, malformed extraction, one 500): row gets an
  error state + retry; other rows unaffected.
- **Transient errors** (429/529/network): SDK auto-retries with backoff; the
  orchestrator retries a failed row once more before surfacing it. Safe —
  the pipeline is stateless and idempotent.
- **Partial extraction** ("can't read ABV"): not an error. Every schema field
  is nullable; null → ❓ verdict.
- **API outage mid-batch**: completed rows keep their results (client state);
  remaining rows fail with a "retry remaining" action. Nothing lost, nothing
  re-run.
- **Confidently wrong extraction**: mitigated by design — no verdict
  auto-approves; worst case the agent re-checks a flagged field, which is the
  manual status quo.
- **Accepted single point of failure**: the Anthropic API itself. Documented
  trade-off; the pluggable extractor is the mitigation path.

## API

`POST /api/verify` — multipart/form-data

Request: `application` (JSON: `application_id, beverage_type, brand_name,
class_type, abv, net_contents`) + `images[]` (1–2 files, front/back).

Response:

```jsonc
{
  "extracted": { /* LabelFields: per-field value + confidence + source image */ },
  "verdicts": [
    {
      "field": "brand_name",
      "status": "probable_match",   // match | probable_match | mismatch | unreadable
      "label_value": "STONE'S THROW",
      "application_value": "Stone's Throw",
      "explanation": "Case differs; otherwise identical."
    }
  ],
  "overall": "needs_review"          // derived: worst field wins
}
```

Errors return actionable messages (unreadable image, upstream API failure,
malformed request) with appropriate status codes; the client surfaces them on
the affected row only.

## Extraction vs. comparison (the core split)

- **Extraction (LLM):** Claude vision with tool-use structured output —
  response is schema-validated `LabelFields`, never prose-parsed. The model
  reports what the label says, including caps/bold observations for the
  warning, plus per-field confidence; it renders no compliance judgment.
- **Comparison (deterministic code):** case-folding, punctuation stripping,
  ABV/proof arithmetic (proof = 2 × ABV), net-contents unit normalization
  (mL↔L, and fl oz/pints/quarts/gallons for malt per §7.70), verbatim
  §16.21 warning compare (whitespace-normalized exact match; caps checked in
  code; bold is LLM-reported best-effort with a stated confidence caveat),
  beverage-type rules (e.g., wine ≤14% ABV may omit alcohol content when
  designated "table wine"/"light wine").

This keeps every verdict testable and explainable; the LLM is confined to
perception.

## Extractor implementations and production paths

`Extractor` is one function: `extract(images, beverageType) → LabelFields`.
Implementations are interchangeable behind config:

| Path | Hosting | Accuracy | Cost (TTB volume: ~150k labels/yr) | When |
|---|---|---|---|---|
| Claude API (ships in prototype) | Anthropic, single egress endpoint | Best | ~$3–6k/yr in API calls | Prototype; production with one allowlisted domain |
| Frontier model in TTB's Azure tenant (Azure AI Foundry / Azure Government) | TTB cloud boundary | Best | API pricing, no egress | **Recommended production path** — firewall problem dissolves |
| Local VLM (Ollama/vLLM + Qwen2.5-VL class) | GPU VM or on-prem | Good, below frontier | ~$9–25k/yr GPU + ops burden | Air-gapped mandate only |
| Classical OCR (PaddleOCR via small FastAPI sidecar) | CPU, anywhere | Weak on stylized/curved labels | Cheapest compute | Benchmark/fallback data point |

Nobody picks local inference at this volume to save money; it exists for the
no-egress-permitted scenario. The deployed prototype uses the Claude API —
the demo runs outside TTB's network, so the firewall constraint does not
apply to it (see PRD "Constraints & trade-offs").

## Latency budget (≤5s per label)

| Step | Time |
|---|---|
| Client downscale | ~0.2s |
| Upload | ~0.3s |
| Claude vision call (1–2 images, single pass) | ~2–4s |
| Comparison + response | ~0ms |

No multi-pass extraction; front+back images go in one request.

## Abuse protection (public demo endpoint)

The deployed URL is public and every request spends real API money. Cheap
guardrails, all in the `/api/verify` route:

- Per-IP rate limit (in-memory token bucket is fine per-instance for a demo).
- Server-side payload validation: max images per request, max body size,
  image MIME allowlist.
- Spending cap on the API key in the Anthropic console (backstop).
- Optional: a demo passcode supplied with the submission.

## Test fixtures

AI image generators are unreliable at small verbatim text — exactly what the
government-warning check needs. Two-track fixture strategy:

- **Programmatic labels** (HTML/CSS → screenshot, or canvas → PNG) for
  correctness fixtures: every character controlled, so seeded errors
  (title-case warning, wrong ABV, missing net contents) are exact.
- **AI-generated labels** for realism: stylized fonts, bottle photos, glare,
  angles — the perception stress tests.

Expect the main build-time iteration loop to be the extraction prompt against
these fixtures (bold detection especially — best-effort by design).

## Deployment

- **v1: Vercel.** Zero-ops, free tier, fits the stateless design.
- The same repo deploys as a Docker container (Fly/Railway) unchanged — the
  path if an in-process or sidecar extractor experiment ever needs it.
- Config: `ANTHROPIC_API_KEY` (server-side env var only; never exposed to the
  client). No database, no buckets, no other services.

## Testing

- Vitest unit tests on `core/compare` and `core/rules` — fixtures encode the
  seeded-error cases (wrong ABV, title-case warning, missing warning,
  mismatched brand, wrong net contents, proof/ABV disagreement).
- Extractor tested with recorded fixture responses (no live API in CI).
- Manual E2E: fixture batch through the deployed app.
