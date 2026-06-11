# Label Verify

AI-assisted alcohol label verification for TTB compliance agents. Paste the
COLA application data, upload the label artwork, and get per-field verdicts —
✅ match, ⚠️ probable match, ❌ mismatch, ❓ unreadable — with plain-language
explanations for anything flagged. The agent stays the decision-maker; the
tool does the rote matching.

**Live demo:** https://verify-label.vercel.app

Requirements live in [docs/PRD.md](docs/PRD.md), technical design in
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), build order in
[docs/PLAN.md](docs/PLAN.md).

## Run it

```sh
pnpm install
echo 'OPENAI_API_KEY=sk-...' > .env.local
pnpm dev          # http://localhost:3000
```

```sh
pnpm test         # Vitest: comparison engine, rules, extractors (recorded
                  # responses — no live API), API handler
pnpm build        # production build
```

No database, no other services. The only secret is the vision API key,
server-side only.

### Try it in 10 seconds

Both pages ship one-click demo data (no files needed):

- **Single label** (`/`) — "Load an example" fills the form and attaches
  fixture images: a clean pass, a wrong-ABV fail, an unreadable photo, …
- **Batch** (`/batch`) — "Load the sample batch" runs the full 55-row fixture
  CSV with 104 label images, including every seeded error from the PRD.

Or bring your own: the CSV format is documented in-app (and below), sample
files live in [`fixtures/`](fixtures/).

## What it checks

| Field | Rule |
|---|---|
| Brand name | Matches application; fuzzy (case/punctuation/OCR noise) differences are flagged ⚠️, never silently passed |
| Class/type | Matches application |
| Alcohol content | Value matches; proof cross-checked (proof = 2×ABV); wine may state a range (width limits per §4.36, application value must fall inside); beverage-type rules for when the statement may be omitted or is mandatory |
| Net contents | Units normalized (mL↔L, fl oz/pints/quarts/gallons); metric required for spirits/wine, US customary for malt, the other system as supplement only; dual statements cross-checked |
| Government warning | **Verbatim** match to 27 CFR §16.21; "GOVERNMENT WARNING" must be all caps and bold; mismatch explanations pinpoint the first divergence |
| Same field of vision (spirits) | Brand, class/type, and alcohol content must appear on the same label side (§5.63) |

Citations and the full rule matrix: [docs/PRD.md](docs/PRD.md#verification-checks).

## Approach

**Extraction is an LLM; comparison is deterministic code.** One vision call
per label (strict structured output, every field nullable, per-field
confidence + source image) reports *what the label says* — it renders no
compliance judgment. Normalization, ABV/proof math, unit conversion, verbatim
warning compare, and beverage-type rules are plain TypeScript in
[`core/`](core/), unit-tested against a 55-case fixture batch. Every verdict
is testable and explainable; the LLM is confined to perception.

**Client-orchestrated batch.** The browser parses the CSV (PapaParse),
unzips images lazily (fflate), downscales each via canvas, pre-flight
validates without spending an API call, then fires `POST /api/verify` per row
at bounded concurrency (~8) with per-row isolation and retry. No job queue,
no storage, no websockets — the backend is one stateless endpoint. 300 labels
≈ 3 minutes.

**Pluggable extractor.** `Extractor` is one function:
`extract(images, beverageType) → LabelFields`.

| Env var | Default | Effect |
|---|---|---|
| `OPENAI_API_KEY` | — | Required for the default extractor |
| `EXTRACTOR_PROVIDER` | `openai` | `claude` switches to the Anthropic implementation (`ANTHROPIC_API_KEY`) |
| `EXTRACTOR_MODEL` | `gpt-5.4-mini` | Model override within the chosen provider |

The default — gpt-5.4-mini with reasoning off — was chosen on a measured
benchmark over the fixture batch (54 verdict-scored cases, live API): 3.9s
per label, the only config under the ≤5s budget, ~$0.01/label, zero
hallucinated readings, every seeded content error caught. Claude
implementations (including an N-vote consensus wrapper) ship alongside.
Numbers and reasoning: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#extractor-benchmark-54-case-fixture-batch-june-2026).
Reproduce with `pnpm extract:eval` (live API).

## Assumptions

- Application data arrives as a form or CSV with the columns
  `application_id, beverage_type, brand_name, class_type, abv, net_contents,
  image_files` — pairing images to rows is **explicit by filename**
  (semicolon-separated, front and back). Content-based auto-pairing is
  deliberately out: same-brand SKU batches differing only in ABV would
  mispair. Extracted content is used only as a cross-check ("possible wrong
  image attached").
- ≤5s per label is the hard adoption threshold (a prior 30–40s vendor pilot
  failed on it), so: one vision call per label, no multi-pass pipelines.
- Prototype security posture per stakeholders: no auth, no PII, nothing
  persisted — images live in request memory only.
- Out of scope (deliberate, documented in the
  [PRD](docs/PRD.md#constraints--trade-offs-documented-deliberate)): COLA
  integration, type-size rules, prohibited-practices judgment, ABV tolerances
  (those govern product-vs-label lab analysis, not label-vs-application
  matching), formulation-triggered disclosures the CSV can't carry.

## Trade-offs

- **Cloud vision API vs. TTB's firewall.** TTB's network blocks most outbound
  domains. The prototype runs on the OpenAI API because the demo runs
  *outside* TTB's network; the production path is below. Mitigated trade-off,
  not an oversight.
- **Bold detection is best-effort.** The §16.21 caps check is code (exact);
  bold is LLM-reported from pixels with a stated confidence caveat.
- **Closing the tab abandons an in-flight batch.** Acceptable with
  session-only state; a server-side queue is the v2 answer if persistence is
  ever required.
- **Absent vs. unreadable.** The default extractor occasionally classifies an
  obscured field ❌ (absent) instead of ❓ (unreadable). Both verdicts route
  the row to a human; it never hallucinates a reading, which is the failure
  mode that would matter.
- **Public demo endpoint spends real money**, so `/api/verify` carries
  invisible bot verification ([Vercel BotID](https://vercel.com/docs/botid) —
  scripted clients get a 403, humans see nothing), a per-IP token bucket,
  payload validation (max 2 images, 4MB each, MIME allowlist), and a spending
  cap on the API key in the provider console.

## Production paths

The pluggable extractor is the mechanism for the firewall constraint:

1. **Single allowlisted egress endpoint** to the vision API (smallest change).
2. **Model in TTB's existing Azure tenant** (Azure OpenAI / Azure
   Government) — traffic never leaves their boundary, and the default
   extractor's model family is natively hosted there, so the swap is config,
   not rework. **Recommended.**
3. **Local VLM** (Ollama/vLLM) behind the same interface, if air-gapped.

Cost/accuracy/hosting comparison:
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#extractor-implementations-and-production-paths).

## Repo layout

```
core/             Pure TS, zero framework imports — the substantive codebase
  types.ts        ApplicationData, LabelFields, Verdict — shared end-to-end
  extractor/      Extractor interface; openai (default), claude, consensus
  compare/        normalization + per-field matchers + verdict derivation
  rules/          beverage-type rules, §16.21 warning text constant
app/              Next.js App Router pages + api/verify route
components/       upload, batch progress, results table, detail views
fixtures/         55-case sample batch: CSV, expected verdicts, generator
public/fixtures/  rendered label PNGs (served to the in-app demo loaders)
scripts/          extract-eval.ts — live extractor benchmark
```

Fixture strategy (programmatic labels for exact-text correctness cases,
CSS photo-realism effects for perception stress tests):
[fixtures/README.md](fixtures/README.md).

## Deployment

Vercel, zero config: `vercel deploy --prod` with `OPENAI_API_KEY` set as a
server-side environment variable. The same repo deploys as a Docker container
unchanged if ever needed.
