# Plan

Build order for the label verification prototype. Requirements live in
[docs/PRD.md](docs/PRD.md); design in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## 1. Scaffold

- Next.js (App Router, TypeScript) + Vitest; repo layout per architecture doc
  (`core/`, `app/`, `components/`, `fixtures/`).
- `core/types.ts`: `ApplicationData`, `LabelFields`, `Verdict`.

## 2. Core comparison engine (pure TS, test-first)

- `core/rules/`: beverage-type config, §16.21 warning text constant.
- `core/compare/`: normalization + per-field matchers (brand fuzzy match,
  class/type, ABV + proof cross-check + wine ranges, net contents mL/L,
  verbatim warning, same-field-of-vision) + overall verdict derivation.
- Vitest coverage for every matcher, including the seeded-error cases.

## 3. Fixtures

- Programmatic labels (exact text control) for correctness cases, including
  seeded errors: wrong ABV, title-case warning, missing warning, mismatched
  brand, wrong net contents.
- AI-generated labels for realism/perception stress tests.
- Sample CSV (~20 rows) pairing applications to images.

## 4. Extraction

- `Extractor` interface + vision implementations (strict structured output,
  nullable fields, per-field confidence + source image). Default: OpenAI
  gpt-5.4-mini with reasoning off, chosen on the measured fixture benchmark
  (architecture doc, "Extractor benchmark") — the only config under the ≤5s
  budget. Claude implementation and an N-vote consensus wrapper alongside.
- Iterate the extraction prompt against fixtures (`pnpm extract:eval`;
  bold detection is best-effort).
- Recorded-response tests; no live API in CI.

## 5. API route

- `POST /api/verify`: multipart parse → extract → compare → verdict JSON.
- Payload validation, actionable errors, rate limiting.

## 6. UI — single label

- Form + image upload (front/back) → results: side-by-side per field,
  color-coded verdicts, plain-language explanations.
- Zero-training UX bar; one obvious primary action per screen.
- Warning-text mismatch explanations should pinpoint the first divergence
  from the §16.21 text (today they just say "doesn't match verbatim").

## 7. UI — batch

- CSV + images (multi-select / zip), pre-flight validation, client
  orchestrator (concurrency ~8, per-row retry), live progress with tallies,
  sortable results table, row detail view, results CSV export.

## 8. Ship

- Deploy to Vercel (`OPENAI_API_KEY`, spending cap, abuse guardrails).
- README: setup/run, approach, assumptions, trade-offs, production paths.
- Verify success criteria: single label ≤5s end-to-end; seeded-error batch
  all caught; first-time-user walkthrough.
