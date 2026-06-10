# Fixtures

Sample batch for the label verifier: 55 application rows backed by 104
rendered label images, with expected verdicts for every row. Strategy per
[docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md) ("Test fixtures"): two
tracks, flat programmatic labels for correctness and CSS photo-realism
effects over the same exact-text rendering for perception stress tests.

## Layout

| Path | What |
|---|---|
| `cases.ts` | **Single source of truth.** Each case = application data + exactly what's printed on each label side + expected verdicts. Everything below is generated from it. |
| `images/` | Rendered label PNGs (`app-0XX-front.png` / `-back.png`), committed. |
| `applications.csv` | The sample batch CSV (`image_files` pairs rows to images by filename, semicolon-separated). |
| `expected.json` | Expected per-field verdict + overall status per row, with a note explaining each case. |
| `preflight/` | Deliberately invalid CSVs (missing image reference, missing column) for testing batch pre-flight validation. |
| `extraction.ts` | Derives the *ideal extraction* for a case — what a perfect vision extractor would report for its images. |
| `cases.test.ts` | Proves every case's declared expectations against `core/compare` (runs in `pnpm test`), so fixtures can't drift from the engine. |
| `generate/` | The generator: case spec → HTML label → Playwright screenshot, plus CSV/JSON writers. |

## Regenerating

```sh
pnpm fixtures:generate
```

Renders with the system Google Chrome (`channel: "chrome"`) — no Playwright
browser download needed. Output is deterministic apart from font rasterizing,
so regenerating only matters after editing `cases.ts` or the templates.

## What the batch covers

- The PRD's seeded errors: wrong ABV, title-case warning, missing warning,
  mismatched brand, wrong net contents — plus proof/ABV contradiction, wine
  range violations (too wide; application outside range), malt metric-only
  net contents, flavored malt missing its mandatory ABV, and a
  field-of-vision split (§5.63).
- The remaining content-failure paths (APP-035–039): spirits omitting the
  alcohol statement entirely, a paraphrased government warning, spirits
  with US-customary-only net contents, spirits stating an ABV range, and a
  standalone class/type mismatch.
- Varied correct labels (APP-040–049), the extractor's false-positive
  baseline: six label styles (including script and colored craft faces),
  single-image bottles and cans, a wine alcohol range on the back label
  (legal — no field-of-vision rule for wine), dual-unit net contents,
  legal alcohol omissions, decoy small print, and two with photo effects.
- Subtle content errors (APP-050–055), legible but easy to autocorrect:
  44.5% printed against a 45% application (internally consistent proof, on
  a curved bottle), a proof line off by two against a matching alc/vol
  statement, a warning missing the single word "operate", a warning with
  "alcohol" substituted for "alcoholic beverages", 350 mL against a
  375 mL application, and a dual net-contents statement whose US-customary
  supplement contradicts its matching metric primary. These exist to punish
  a vision extractor that normalizes or autocorrects instead of
  transcribing faithfully.
- All four verdict categories (✅ ⚠️ ❌ ❓) and all three overall statuses:
  21 pass / 11 needs-review / 23 fail.
- A wrong-image-attached row (APP-019 references APP-005's images).
- One single-image row (APP-012, beer can) among front+back pairs.
- A perception case (APP-017) whose alcohol statement is printed but
  unreadably blurred — the honest answer is ❓, never a guess.
- An extraneous-text case (APP-031): decoy small print stuffed with
  field-shaped numbers — "AGED 12 YEARS", "BATCH No. 86", "EST. 1897", a
  street address containing 750, a 2 oz serving suggestion. The engine
  never sees these (the ideal extraction ignores them); they exist to
  tempt the vision extractor into misreading ages as ABV or addresses as
  net contents. Expected: clean pass.
- Photo-realism cases (APP-022–034, below).

## Photo-realism track (CSS effects, APP-022–034)

Flat programmatic labels make text exact but look nothing like a photo of a
bottle. Instead of AI-generated images (which can't be trusted with verbatim
small text), realism cases reuse the same exact-text HTML rendering and add
an opt-in effects layer (`EffectsSpec` in `cases.ts`, rendered by
`generate/html.ts`): cylinder curvature (a real pixel warp — the label is
captured flat, then remapped onto a cylinder via canvas in a second
Playwright pass, bowing the edges and compressing the sides — plus edge
shading and a specular highlight), off-axis camera angle, diagonal glare
streaks, film grain,
vignette + lighting color cast, dim cellar lighting, washed-out low-contrast
print, tone-on-tone ghost ink, underexposure, dirt specks, whole-frame focus
blur, handheld-tilt rotation, a poorly cropped frame, a camera-lens smudge
anchored over the alcohol statement, and a blown-out glare hotspot anchored
over the warning. Effect shots are framed in a photographic scene (dark
backdrop, drop shadow) rather than cropped to the label edge.

Every readability-degrading effect appears in a *pass* (degraded but
legible) and a *failure* (degraded past reading → ❓):

| Effect | Pass | Failure |
|---|---|---|
| blur / focus | APP-027 (slightly out of focus) | APP-017 (blurred statement), APP-033 (front out of focus) |
| glare | APP-022 (streaks) | APP-030 (hotspot over the warning) |
| low light | APP-025 (cellar shot) | APP-034 (underexposed, nothing readable) |
| low contrast | APP-029 (sun-faded) | APP-032 (ghost ink, only the brand survives) |
| smudge | — | APP-024 (lens smudge over the alcohol statement) |
| crop | — | APP-028 (net contents out of frame) |

Plus a seeded error under heavy combined effects (APP-026, wrong net
contents on a curved, glared, grainy label) and a tilted-grain-vignette
pass (APP-023).

Fields a case declares unreadable (`unreadable` on the label side) render
with a guaranteed blur underneath whatever effect tells the visual story,
and drive the ideal extraction in `extraction.ts` to null/low-confidence —
unreadability holds by construction, not just by effect intensity.

The CSS guarantees what each label *says*, not that it's *legible* under
the effects — so after any regeneration that touches effect intensity,
eyeball the realism PNGs: every field a case expects to be read must be
legible, and every field declared `unreadable` must show that something is
printed/cut off without a single readable character.

Each image is annotated by its row in `expected.json` (`note`,
`image_files`, per-field verdicts); the exact printed text behind any
image is its case in `cases.ts`.
