# PRD: AI-Powered Alcohol Label Verification

Prototype for TTB label compliance agents. Compares label artwork against COLA
application data and reports per-field verdicts, so agents spend their time on
judgment calls instead of rote matching.

## Problem

TTB reviews ~150,000 label applications/year with 47 agents. Review is largely
manual field matching (brand name, ABV, net contents, government warning),
5–10 minutes per application. A prior vendor pilot failed on speed (30–40s per
label). This tool automates the matching; the agent stays the decision-maker.

## Users

Compliance agents with widely varying tech comfort (benchmark: "my 73-year-old
mother could figure it out"). UI must be clean, obvious, zero training.

## Core flow

1. Agent provides application data — a form (single label) or CSV (batch).
2. Agent uploads label image(s) — front and/or back.
3. Vision LLM extracts label fields; deterministic code compares against the
   application.
4. Results: side-by-side per field, color-coded verdicts, explanation for
   anything flagged.

## Verification checks

| # | Field | Rule | Source |
|---|-------|------|--------|
| 1 | Brand name | Matches application. Fuzzy: case, punctuation, OCR noise ("STONE'S THROW" vs "Stone's Throw" → probable match, flagged, never silently passed) | 27 CFR §5.64 / §4.33 / §7.64 |
| 2 | Class/type | Matches application (e.g., "Kentucky Straight Bourbon Whiskey") | §5 subpart I / §4.34 |
| 3 | Alcohol content | Value matches; format valid ("Alc. 45% by Vol.", "45% alc/vol", "percent" spelled out — abbreviations allowed). Proof cross-checked against ABV (proof = 2×ABV) and must share the alc/vol statement's field of vision (§5.65(b)(1)(i)). Wine may state a **range** (max 2 points wide >14% ABV, 3 points ≤14%) — accept if the application value falls inside it | §5.65 / §4.36 / §7.65 |
| 4 | Net contents | Matches; required units depend on beverage type — **metric** (mL/L) for spirits and wine, **US customary** (fl oz/pints/quarts/gallons) for malt beverages, with the other system allowed only as a supplement; units normalized for comparison | §5.70 / §4.37 / §7.70 |
| 5 | Government warning | **Verbatim** match to §16.21 text. "GOVERNMENT WARNING" must be all caps and bold; remainder not bold. Title case, paraphrase, or omission → fail | 27 CFR §16.21–16.22 |
| 6 | Same field of vision (spirits) | Brand name, class/type, and alcohol content must appear on the **same side** of the container. With front/back images, flag if these three fields were extracted from different images | §5.63 |
| 7 | Bottler/importer name & address; country of origin (imports) | Stretch goal | §5.66/§5.68 et al. |

Required warning text (exact):

> GOVERNMENT WARNING: (1) According to the Surgeon General, women should not
> drink alcoholic beverages during pregnancy because of the risk of birth
> defects. (2) Consumption of alcoholic beverages impairs your ability to
> drive a car or operate machinery, and may cause health problems.

**Beverage-type awareness:** application specifies spirits / wine / malt
beverage. Toggles rules: wine ≤14% ABV may omit alcohol content if designated
"table wine"/"light wine" (§4.36); malt beverage ABV is optional **except**
when the product contains alcohol from added nonbeverage flavors (flavored
malt beverages), where it is mandatory (§7.65).

**Verdicts (per field):**

- ✅ Match
- ⚠️ Probable match — needs human review (with explanation of the discrepancy)
- ❌ Mismatch / missing
- ❓ Unreadable from image

No bare overall pass/fail that hides field detail; overall status is derived
(worst field wins) and always expandable.

## Batch processing

- **Input:** CSV of applications + zip (or multi-select) of images.
- **Pairing: explicit, by filename.** CSV `image_files` column lists that
  row's image filenames (semicolon-separated; supports front + back — the
  government warning is typically on the back label, so fields merge across a
  row's images).
- **Why not content-based pairing:** importer batches are often many SKUs of
  the same brand differing only in ABV/net contents; fuzzy pairing would
  attach wrong images and report false mismatches. Content is used only as a
  **cross-check**: if the extracted brand name is wildly different from the
  paired row, report "possible wrong image attached" instead of cascading ❌s.
- **Pipeline:**
  1. Pre-flight validation, no API calls: parse CSV, verify columns, flag rows
     referencing missing images and orphan images.
  2. Queue with bounded concurrency (~5–10 parallel extractions). 300 labels
     ≈ 3 min at concurrency 8.
  3. Per-row isolation: one bad image fails that row only; per-row retry.
  4. Live progress: n/total with running ✅/⚠️/❌/❓ tallies.
  5. Results table sortable by verdict (agents triage flagged rows first);
     drill into any row for detail view; export results CSV.
- Single-label mode = batch of one with a form instead of CSV. One pipeline.
- **CSV columns (draft):** `application_id, beverage_type, brand_name,
  class_type, abv, net_contents, image_files`. Sample CSV + images ship in
  the repo.

## Architecture decisions

- **Extraction = vision LLM (Claude); comparison = deterministic code.** The
  LLM only extracts structured fields from the image. Normalization and
  matching (case-folding, punctuation stripping, ABV/proof math, mL/L
  conversion, verbatim warning compare) are plain code: testable, explainable,
  no LLM judgment in the verdict path.
- **Warning check:** exact string compare after whitespace normalization;
  caps checked in code; bold reported by the LLM best-effort with a
  confidence caveat (bold detection from photos is inherently fuzzy).
- **Pluggable extractor interface.** Default: Claude vision API. The
  interface is the seam for swapping in an Azure-hosted or local model.
- **Imperfect images** (angles, glare, lighting): handled implicitly by the
  vision LLM; ❓ verdict when genuinely unreadable, never a guess.

## Non-functional requirements

- **≤5s per label** end-to-end (hard adoption threshold per stakeholders).
  One vision API call per image; no multi-pass pipelines.
- **UX:** single obvious primary action per screen; large targets; plain
  language ("Doesn't match — label says 45%, application says 40%"), no
  jargon or hunting for buttons.
- **Error handling:** invalid CSV, unreadable image, API failure all produce
  actionable messages, never a dead end.

## Constraints & trade-offs (documented, deliberate)

- **Cloud API egress vs. TTB firewall.** TTB's network blocks many outbound
  domains (killed a prior vendor pilot). Decision: build the prototype on a
  cloud vision API — the deployed demo runs outside TTB's network — and
  document the production path at the end: single allowlisted egress endpoint
  → model hosted in TTB's existing Azure tenant (Azure AI Foundry /
  Azure Government, traffic never leaves their boundary) → local model if
  air-gapped. The pluggable extractor is the mechanism. This is a mitigated
  trade-off, not an oversight.
- **Prototype security posture:** no PII, no retention requirements, no auth
  (per IT stakeholder). Don't store uploads beyond the session.

## Out of scope

- COLA system integration, FedRAMP, auth.
- Type-size / characters-per-inch / contrasting-background rules (TTB itself
  doesn't review these in COLAs; applicant's responsibility).
- Prohibited-practices judgment (misleading claims, health claims, etc.).
- Content-based image↔application auto-pairing (cross-check only; see Batch).
- **ABV tolerances** (±0.3% spirits/beer §5.65/§7.65; ±1.0/1.5% wine §4.36):
  these govern actual product vs. label (lab analysis), not label vs.
  application matching — the tool's job is the latter.
- **Conditional formulation disclosures** (sulfites ≥10ppm, FD&C Yellow No. 5,
  cochineal/carmine, aspartame PHENYLKETONURICS statement, neutral-spirits
  percentage, state of distillation): triggered by formulation data the
  application CSV doesn't carry, so unverifiable by design.
- Standards of fill (authorized container sizes) — verifiable in principle
  from net contents, but low value since the list was greatly expanded
  in 2020; possible v2 lookup table.

## Deliverables

1. Repo: source, README (setup/run, approach, tools, assumptions,
   trade-offs), sample CSV + test label images (AI-generated).
2. Deployed, publicly accessible URL.

## Stack (recommendation)

Next.js (single deployable, API routes for the extraction/compare pipeline),
Claude vision API behind the extractor interface, deployed on Vercel. Chosen
for fastest path to a polished deployed prototype; no DB needed (session-only
state).

## References

- [27 CFR Part 16](https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-16) — Health Warning Statement (verbatim text §16.21, formatting §16.22)
- [27 CFR Part 5](https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-5) — distilled spirits labeling (brand §5.64, ABV §5.65, same field of vision §5.63, net contents §5.70)
- [27 CFR Part 4](https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-4) — wine labeling (ABV rules/ranges §4.36)
- [27 CFR Part 7](https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-7) — malt beverage labeling (ABV §7.65, net contents in US measure §7.70)
- [TTB: Certificate of Label Approval (COLA)](https://www.ttb.gov/regulated-commodities/labeling/colas) — what reviewers check, process context
- [TTB Distilled Spirits Labeling Checklist (PDF)](https://www.ttb.gov/system/files/images/labeling-ds/ds-labeling-checklist.pdf) — closest analog to the agents' printed checklist

## Success criteria

- Sample label (Old Tom Distillery) verifies correctly end-to-end in ≤5s.
- Batch of ~20 sample labels with seeded errors (wrong ABV, title-case
  warning, missing warning, mismatched brand, wrong net contents) all caught
  and correctly categorized.
- A first-time user completes a single-label check with no instructions.
