// Fixture cases — the single source of truth for the sample batch.
// Each case drives three generated artifacts (see fixtures/generate):
//   images/app-0XX-{front,back}.png   rendered label images
//   applications.csv                  the batch CSV row
//   expected.json                     expected per-field verdicts
// cases.test.ts proves the declared expectations against core/compare, so
// the shipped fixtures can never drift from the engine's actual behavior.

import { GOVERNMENT_WARNING } from "../core/rules/warning";
import type {
  ApplicationData,
  OverallStatus,
  Verdict,
  VerdictStatus,
} from "../core/types";

export interface WarningSpec {
  /** Exact text printed on the label. */
  text: string;
  /** Rendered bold formatting. Defaults: heading bold, remainder not. */
  headingBold?: boolean;
  remainderBold?: boolean;
}

/** Photo-realism effects, rendered around an otherwise exact label (see
 * fixtures/generate/html.ts). Purely visual: they never change what the
 * label says, only how legible it is — which is why realism cases must be
 * vetted by eye after regenerating. */
export interface EffectsSpec {
  /** Cylindrical bottle curvature: perspective tilt + edge shading + a
   * vertical specular highlight. */
  curvature?: boolean;
  /** Diagonal low-alpha glare streaks across the glass. */
  glare?: boolean;
  /** Film grain over the whole frame. */
  grain?: boolean;
  /** Corner vignette + a warm lighting color cast on the label. */
  vignette?: boolean;
  /** Dim, low-contrast lighting (cellar shot). */
  dim?: boolean;
  /** Washed-out print — low label/text contrast, as on a sun-faded label. */
  faded?: boolean;
  /** Tone-on-tone label design: everything except the brand printed in
   * barely-there ink. The designed cousin of `faded`. */
  ghostInk?: boolean;
  /** Exposure multiplier (<1 = underexposed shot; .3 is "phone photo in
   * an unlit cellar"). */
  exposure?: number;
  /** Small dark dirt specks on the glass. */
  dirt?: boolean;
  /** Blurred translucent camera-lens smudge anchored over the alcohol
   * statement. Pair with `unreadable: ["alcohol"]` so the unreadability
   * is guaranteed, not just likely. */
  smudge?: "alcohol";
  /** Blown-out glare hotspot anchored over the warning statement. Pair
   * with `unreadable: ["warning"]` (same reasoning as `smudge`). */
  glareOver?: "warning";
  /** Whole-frame rotation in degrees (handheld camera tilt). */
  rotate?: number;
  /** Camera angle: rotateY degrees of perspective skew (a shot from
   * off to the side). Implies the perspective wrapper. */
  angle?: number;
  /** Whole-frame focus blur in px — an out-of-focus photo. Keep small
   * for fields that must stay readable; pair larger values with
   * `unreadable` for the fields that don't survive. */
  focusBlur?: number;
  /** Poorly cropped photo: this many px of the label's bottom edge fall
   * outside the frame. Pair with `unreadable: ["netContents"]` when it
   * cuts off the net-contents line. */
  cropBottom?: number;
}

/** Label fields whose print can be marked unreadable on a side. */
export type UnreadableField =
  | "brandName"
  | "classType"
  | "alcohol"
  | "proof"
  | "netContents"
  | "warning";

export interface LabelSideSpec {
  brandName?: string;
  classType?: string;
  /** Alc/vol statement as printed, e.g. "Alc. 45% by Vol." */
  alcohol?: string;
  proof?: string;
  netContents?: string;
  warning?: WarningSpec;
  /** Small-print extraneous lines (ages, batch numbers, founding years,
   * addresses, serving suggestions) rendered at the label's bottom —
   * decoy text full of field-shaped numbers that the extractor must not
   * mistake for regulated fields. Never read by the ideal extraction. */
  extraText?: string[];
  /** Fields printed on this side that can't be read off the photo. Each
   * listed field renders blurred — the guarantee of unreadability — while
   * the side's effects (smudge, hotspot, crop, ghost ink, exposure,
   * focus) tell the visual story. Drives the ideal extraction to
   * null/low-confidence (→ ❓, never "absent"). */
  unreadable?: UnreadableField[];
  /** Opt-in photo-realism; absent = the flat programmatic rendering. */
  effects?: EffectsSpec;
}

export type LabelStyle =
  | "classic"
  | "modern"
  | "dark"
  | "vintage"
  | "script"
  | "craft";

export interface FixtureCase {
  application: ApplicationData;
  /** What this case seeds and why it exists. */
  note: string;
  /** 1–2 label sides; array index = image index (0 front, 1 back). */
  sides?: LabelSideSpec[];
  /** Reuse another case's images — the wrong-image-attached scenario. */
  imagesFrom?: string;
  style: LabelStyle;
  expected: {
    overall: OverallStatus;
    /** Deviations only; any field not listed is expected to be "match". */
    verdicts: Partial<Record<Verdict["field"], VerdictStatus>>;
  };
}

const WARNING: WarningSpec = { text: GOVERNMENT_WARNING };

const TITLE_CASE_WARNING = GOVERNMENT_WARNING.replace(
  "GOVERNMENT WARNING:",
  "Government Warning:",
);

export const FIXTURE_CASES: FixtureCase[] = [
  {
    application: {
      application_id: "APP-001",
      beverage_type: "spirits",
      brand_name: "Old Tom Distillery",
      class_type: "Kentucky Straight Bourbon Whiskey",
      abv: 45,
      net_contents: "750 mL",
    },
    note: "Clean pass — the PRD's success-criteria sample.",
    style: "classic",
    sides: [
      {
        brandName: "Old Tom Distillery",
        classType: "Kentucky Straight Bourbon Whiskey",
        alcohol: "Alc. 45% by Vol.",
        proof: "90 Proof",
        netContents: "750 mL",
      },
      { warning: WARNING },
    ],
    expected: { overall: "pass", verdicts: {} },
  },
  {
    application: {
      application_id: "APP-002",
      beverage_type: "spirits",
      brand_name: "Blue Heron",
      class_type: "Straight Rye Whiskey",
      abv: 45,
      net_contents: "750 mL",
    },
    note: "Seeded error: label states 40% ABV, application says 45%.",
    style: "dark",
    sides: [
      {
        brandName: "Blue Heron",
        classType: "Straight Rye Whiskey",
        alcohol: "Alc. 40% by Vol.",
        proof: "80 Proof",
        netContents: "750 mL",
      },
      { warning: WARNING },
    ],
    expected: { overall: "fail", verdicts: { alcohol_content: "mismatch" } },
  },
  {
    application: {
      application_id: "APP-003",
      beverage_type: "spirits",
      brand_name: "Cedar Ridge",
      class_type: "Straight Bourbon Whiskey",
      abv: 43,
      net_contents: "750 mL",
    },
    note: 'Seeded error: government warning printed in title case ("Government Warning:").',
    style: "classic",
    sides: [
      {
        brandName: "Cedar Ridge",
        classType: "Straight Bourbon Whiskey",
        alcohol: "Alc. 43% by Vol.",
        proof: "86 Proof",
        netContents: "750 mL",
      },
      { warning: { text: TITLE_CASE_WARNING } },
    ],
    expected: { overall: "fail", verdicts: { government_warning: "mismatch" } },
  },
  {
    application: {
      application_id: "APP-004",
      beverage_type: "spirits",
      brand_name: "Juniper & Pine",
      class_type: "London Dry Gin",
      abv: 47,
      net_contents: "1 L",
    },
    note: "Seeded error: government warning missing from both sides.",
    style: "modern",
    sides: [
      {
        brandName: "Juniper & Pine",
        classType: "London Dry Gin",
        alcohol: "Alc. 47% by Vol.",
        proof: "94 Proof",
        netContents: "1 L",
      },
      {},
    ],
    expected: { overall: "fail", verdicts: { government_warning: "mismatch" } },
  },
  {
    application: {
      application_id: "APP-005",
      beverage_type: "spirits",
      brand_name: "Silver Creek",
      class_type: "Vodka",
      abv: 40,
      net_contents: "750 mL",
    },
    note: 'Seeded error: label brand "Golden Gate" does not match application "Silver Creek".',
    style: "modern",
    sides: [
      {
        brandName: "Golden Gate",
        classType: "Vodka",
        alcohol: "Alc. 40% by Vol.",
        proof: "80 Proof",
        netContents: "750 mL",
      },
      { warning: WARNING },
    ],
    expected: { overall: "fail", verdicts: { brand_name: "mismatch" } },
  },
  {
    application: {
      application_id: "APP-006",
      beverage_type: "spirits",
      brand_name: "Whitetail",
      class_type: "Tennessee Whiskey",
      abv: 40,
      net_contents: "750 mL",
    },
    note: "Seeded error: label states 700 mL, application says 750 mL.",
    style: "dark",
    sides: [
      {
        brandName: "Whitetail",
        classType: "Tennessee Whiskey",
        alcohol: "Alc. 40% by Vol.",
        proof: "80 Proof",
        netContents: "700 mL",
      },
      { warning: WARNING },
    ],
    expected: { overall: "fail", verdicts: { net_contents: "mismatch" } },
  },
  {
    application: {
      application_id: "APP-007",
      beverage_type: "spirits",
      brand_name: "Stone's Throw",
      class_type: "Straight Bourbon Whiskey",
      abv: 46,
      net_contents: "750 mL",
    },
    note: 'Fuzzy match: label prints "STONE\'S THROW" in caps — probable match, flagged, never silently passed.',
    style: "classic",
    sides: [
      {
        brandName: "STONE'S THROW",
        classType: "Straight Bourbon Whiskey",
        alcohol: "Alc. 46% by Vol.",
        proof: "92 Proof",
        netContents: "750 mL",
      },
      { warning: WARNING },
    ],
    expected: {
      overall: "needs_review",
      verdicts: { brand_name: "probable_match" },
    },
  },
  {
    application: {
      application_id: "APP-008",
      beverage_type: "spirits",
      brand_name: "Copper Kettle",
      class_type: "Single Malt Whiskey",
      abv: 45,
      net_contents: "750 mL",
    },
    note: "Seeded error: label contradicts itself — 45% ABV printed with 94 proof (should be 90).",
    style: "vintage",
    sides: [
      {
        brandName: "Copper Kettle",
        classType: "Single Malt Whiskey",
        alcohol: "Alc. 45% by Vol.",
        proof: "94 Proof",
        netContents: "750 mL",
      },
      { warning: WARNING },
    ],
    expected: { overall: "fail", verdicts: { alcohol_content: "mismatch" } },
  },
  {
    application: {
      application_id: "APP-009",
      beverage_type: "wine",
      brand_name: "Willow Bend",
      class_type: "Chardonnay",
      abv: 13,
      net_contents: "750 mL",
    },
    note: "Wine ABV range, valid: 12–14% is ≤3 points wide and contains the application's 13%.",
    style: "vintage",
    sides: [
      {
        brandName: "Willow Bend",
        classType: "Chardonnay",
        alcohol: "Alcohol 12% to 14% by Volume",
        netContents: "750 mL",
      },
      { warning: WARNING },
    ],
    expected: { overall: "pass", verdicts: {} },
  },
  {
    application: {
      application_id: "APP-010",
      beverage_type: "wine",
      brand_name: "Veranda",
      class_type: "Red Wine",
      abv: 15.5,
      net_contents: "750 mL",
    },
    note: "Seeded error: wine over 14% ABV states a 3-point range (14–17%); the maximum is 2 points.",
    style: "modern",
    sides: [
      {
        brandName: "Veranda",
        classType: "Red Wine",
        alcohol: "Alcohol 14% to 17% by Volume",
        netContents: "750 mL",
      },
      { warning: WARNING },
    ],
    expected: { overall: "fail", verdicts: { alcohol_content: "mismatch" } },
  },
  {
    application: {
      application_id: "APP-011",
      beverage_type: "wine",
      brand_name: "Old Vine Cellars",
      class_type: "Red Table Wine",
      abv: 12,
      net_contents: "750 mL",
    },
    note: "Wine ≤14% designated table wine may omit alcohol content (§4.36) — no statement, still a pass.",
    style: "vintage",
    sides: [
      {
        brandName: "Old Vine Cellars",
        classType: "Red Table Wine",
        netContents: "750 mL",
      },
      { warning: WARNING },
    ],
    expected: { overall: "pass", verdicts: {} },
  },
  {
    application: {
      application_id: "APP-012",
      beverage_type: "malt",
      brand_name: "Crooked Anchor",
      class_type: "India Pale Ale",
      abv: 6.5,
      net_contents: "12 fl oz",
    },
    note: 'Malt pass on a single image: US-customary net contents, "percent" spelled out in the alcohol statement.',
    style: "modern",
    sides: [
      {
        brandName: "Crooked Anchor",
        classType: "India Pale Ale",
        alcohol: "6.5 percent alcohol by volume",
        netContents: "12 FL. OZ.",
        warning: WARNING,
      },
    ],
    expected: { overall: "pass", verdicts: {} },
  },
  {
    application: {
      application_id: "APP-013",
      beverage_type: "malt",
      brand_name: "Iron Bell",
      class_type: "Lager",
      abv: 5,
      net_contents: "12 fl oz",
    },
    note: "Seeded error: malt beverage shows metric-only net contents (355 mL); US measure is required (§7.70). ABV omitted — allowed for this malt.",
    style: "modern",
    sides: [
      {
        brandName: "Iron Bell",
        classType: "Lager",
        netContents: "355 mL",
      },
      { warning: WARNING },
    ],
    expected: { overall: "fail", verdicts: { net_contents: "mismatch" } },
  },
  {
    application: {
      application_id: "APP-014",
      beverage_type: "malt",
      brand_name: "Tidal Wave",
      class_type: "Flavored Malt Beverage",
      abv: 5,
      net_contents: "16 fl oz",
    },
    note: "Seeded error: flavored malt beverage omits alcohol content, which is mandatory for it (§7.65).",
    style: "dark",
    sides: [
      {
        brandName: "Tidal Wave",
        classType: "Flavored Malt Beverage",
        netContents: "16 FL. OZ.",
      },
      { warning: WARNING },
    ],
    expected: { overall: "fail", verdicts: { alcohol_content: "mismatch" } },
  },
  {
    application: {
      application_id: "APP-015",
      beverage_type: "spirits",
      brand_name: "North Fork",
      class_type: "Straight Bourbon Whiskey",
      abv: 50,
      net_contents: "750 mL",
    },
    note: "Field-of-vision flag (§5.63): alcohol content only on the back label, brand and class on the front.",
    style: "classic",
    sides: [
      {
        brandName: "North Fork",
        classType: "Straight Bourbon Whiskey",
        netContents: "750 mL",
      },
      {
        alcohol: "Alc. 50% by Vol.",
        warning: WARNING,
      },
    ],
    expected: {
      overall: "needs_review",
      verdicts: { same_field_of_vision: "probable_match" },
    },
  },
  {
    application: {
      application_id: "APP-016",
      beverage_type: "spirits",
      brand_name: "Black Maple",
      class_type: "Straight Bourbon Whiskey",
      abv: 50,
      net_contents: "750 mL",
    },
    note: "Dual-unit net contents — metric primary with a US-customary supplement is allowed for spirits.",
    style: "vintage",
    sides: [
      {
        brandName: "Black Maple",
        classType: "Straight Bourbon Whiskey",
        alcohol: "Alc. 50% by Vol.",
        proof: "100 Proof",
        netContents: "750 mL (25.4 FL. OZ.)",
      },
      { warning: WARNING },
    ],
    expected: { overall: "pass", verdicts: {} },
  },
  {
    application: {
      application_id: "APP-017",
      beverage_type: "spirits",
      brand_name: "Foggy Bottom",
      class_type: "Blended Whiskey",
      abv: 40,
      net_contents: "750 mL",
    },
    note: "Perception case: the alcohol statement is printed but unreadably blurred → ❓, never a guess.",
    style: "dark",
    sides: [
      {
        brandName: "Foggy Bottom",
        classType: "Blended Whiskey",
        alcohol: "Alc. 40% by Vol.",
        netContents: "750 mL",
        unreadable: ["alcohol"],
      },
      { warning: WARNING },
    ],
    expected: {
      overall: "needs_review",
      verdicts: {
        alcohol_content: "unreadable",
        same_field_of_vision: "unreadable",
      },
    },
  },
  {
    application: {
      application_id: "APP-018",
      beverage_type: "spirits",
      brand_name: "Boone County",
      class_type: "Kentucky Straight Bourbon Whiskey",
      abv: 45,
      net_contents: "750 mL",
    },
    note: 'OCR-noise-sized difference: label says "Whisky", application says "Whiskey" — flagged for review.',
    style: "classic",
    sides: [
      {
        brandName: "Boone County",
        classType: "Kentucky Straight Bourbon Whisky",
        alcohol: "Alc. 45% by Vol.",
        proof: "90 Proof",
        netContents: "750 mL",
      },
      { warning: WARNING },
    ],
    expected: {
      overall: "needs_review",
      verdicts: { class_type: "probable_match" },
    },
  },
  {
    application: {
      application_id: "APP-019",
      beverage_type: "spirits",
      brand_name: "Harbor Light",
      class_type: "White Rum",
      abv: 40,
      net_contents: "750 mL",
    },
    note: "Wrong image attached: the CSV row points at APP-005's images — brand and class mismatch while the numeric fields coincide.",
    style: "modern",
    imagesFrom: "APP-005",
    expected: {
      overall: "fail",
      verdicts: { brand_name: "mismatch", class_type: "mismatch" },
    },
  },
  {
    application: {
      application_id: "APP-020",
      beverage_type: "wine",
      brand_name: "Meadowlark",
      class_type: "Rosé Wine",
      abv: 10.5,
      net_contents: "750 mL",
    },
    note: "Seeded error: the application's 10.5% ABV falls outside the label's stated 11–13% range.",
    style: "vintage",
    sides: [
      {
        brandName: "Meadowlark",
        classType: "Rosé Wine",
        alcohol: "Alcohol 11% to 13% by Volume",
        netContents: "750 mL",
      },
      { warning: WARNING },
    ],
    expected: { overall: "fail", verdicts: { alcohol_content: "mismatch" } },
  },
  {
    application: {
      application_id: "APP-021",
      beverage_type: "spirits",
      brand_name: "Quarry Stone",
      class_type: "Straight Corn Whiskey",
      abv: 40,
      net_contents: "750 mL",
    },
    note: 'Formatting flag: warning text verbatim but "GOVERNMENT WARNING" not printed in bold (§16.22).',
    style: "dark",
    sides: [
      {
        brandName: "Quarry Stone",
        classType: "Straight Corn Whiskey",
        alcohol: "Alc. 40% by Vol.",
        proof: "80 Proof",
        netContents: "750 mL",
      },
      { warning: { text: GOVERNMENT_WARNING, headingBold: false } },
    ],
    expected: {
      overall: "needs_review",
      verdicts: { government_warning: "probable_match" },
    },
  },

  // ——— Photo-realism cases (CSS effects over exact text) ———

  {
    application: {
      application_id: "APP-022",
      beverage_type: "spirits",
      brand_name: "Harrow & Sage",
      class_type: "Small Batch Gin",
      abv: 44,
      net_contents: "750 mL",
    },
    note: "Realism: curved bottle with glare streaks, everything legible — clean pass.",
    style: "classic",
    sides: [
      {
        brandName: "Harrow & Sage",
        classType: "Small Batch Gin",
        alcohol: "Alc. 44% by Vol.",
        proof: "88 Proof",
        netContents: "750 mL",
        effects: { curvature: true, glare: true },
      },
      { warning: WARNING, effects: { curvature: true, glare: true } },
    ],
    expected: { overall: "pass", verdicts: {} },
  },
  {
    application: {
      application_id: "APP-023",
      beverage_type: "wine",
      brand_name: "Sable Estate",
      class_type: "Pinot Noir",
      abv: 13.5,
      net_contents: "750 mL",
    },
    note: "Realism: tilted handheld shot with film grain and vignette — still a pass.",
    style: "vintage",
    sides: [
      {
        brandName: "Sable Estate",
        classType: "Pinot Noir",
        alcohol: "Alcohol 13.5% by Volume",
        netContents: "750 mL",
        effects: { rotate: -2.5, grain: true, vignette: true },
      },
      { warning: WARNING, effects: { rotate: 2, grain: true, vignette: true } },
    ],
    expected: { overall: "pass", verdicts: {} },
  },
  {
    application: {
      application_id: "APP-024",
      beverage_type: "spirits",
      brand_name: "Drift Line",
      class_type: "Spiced Rum",
      abv: 42,
      net_contents: "750 mL",
    },
    note: "Realism perception case: a camera-lens smudge covers the alcohol statement → ❓, never a guess (like APP-017).",
    style: "modern",
    sides: [
      {
        brandName: "Drift Line",
        classType: "Spiced Rum",
        alcohol: "Alc. 42% by Vol.",
        netContents: "750 mL",
        unreadable: ["alcohol"],
        effects: { smudge: "alcohol", grain: true, rotate: 1.5 },
      },
      { warning: WARNING, effects: { grain: true, rotate: -1 } },
    ],
    expected: {
      overall: "needs_review",
      verdicts: {
        alcohol_content: "unreadable",
        same_field_of_vision: "unreadable",
      },
    },
  },
  {
    application: {
      application_id: "APP-025",
      beverage_type: "wine",
      brand_name: "Quiet Hollow",
      class_type: "Cabernet Sauvignon",
      abv: 14,
      net_contents: "750 mL",
    },
    note: "Realism: dark low-contrast cellar shot — dim lighting, vignette, grain — but every field still legible. Pass.",
    style: "dark",
    sides: [
      {
        brandName: "Quiet Hollow",
        classType: "Cabernet Sauvignon",
        alcohol: "Alcohol 14% by Volume",
        netContents: "750 mL",
        effects: { dim: true, vignette: true, grain: true },
      },
      { warning: WARNING, effects: { dim: true, vignette: true, grain: true } },
    ],
    expected: { overall: "pass", verdicts: {} },
  },
  {
    application: {
      application_id: "APP-026",
      beverage_type: "spirits",
      brand_name: "Ironwood",
      class_type: "Straight Rye Whiskey",
      abv: 46,
      net_contents: "750 mL",
    },
    note: "Realism + seeded error: heavy effects (curvature, glare, grain, vignette, dirt) over a label stating 700 mL against the application's 750 mL.",
    style: "vintage",
    sides: [
      {
        brandName: "Ironwood",
        classType: "Straight Rye Whiskey",
        alcohol: "Alc. 46% by Vol.",
        proof: "92 Proof",
        netContents: "700 mL",
        effects: {
          curvature: true,
          glare: true,
          grain: true,
          vignette: true,
          dirt: true,
        },
      },
      {
        warning: WARNING,
        effects: { curvature: true, glare: true, grain: true, vignette: true },
      },
    ],
    expected: { overall: "fail", verdicts: { net_contents: "mismatch" } },
  },
  {
    application: {
      application_id: "APP-027",
      beverage_type: "spirits",
      brand_name: "Stonebridge",
      class_type: "Single Barrel Bourbon Whiskey",
      abv: 47,
      net_contents: "750 mL",
    },
    note: "Realism: shot from off to the side and slightly out of focus — everything still legible. Pass.",
    style: "classic",
    sides: [
      {
        brandName: "Stonebridge",
        classType: "Single Barrel Bourbon Whiskey",
        alcohol: "Alc. 47% by Vol.",
        proof: "94 Proof",
        netContents: "750 mL",
        effects: { angle: 18, curvature: true, focusBlur: 1.1, grain: true },
      },
      {
        warning: WARNING,
        effects: { angle: -12, curvature: true, focusBlur: 0.8, grain: true },
      },
    ],
    expected: { overall: "pass", verdicts: {} },
  },
  {
    application: {
      application_id: "APP-028",
      beverage_type: "wine",
      brand_name: "Bramble Gate",
      class_type: "Sauvignon Blanc",
      abv: 12.5,
      net_contents: "750 mL",
    },
    note: "Realism perception case: poorly cropped photo cuts the net-contents line off the bottom of the frame → ❓, never a guess.",
    style: "vintage",
    sides: [
      {
        brandName: "Bramble Gate",
        classType: "Sauvignon Blanc",
        alcohol: "Alcohol 12.5% by Volume",
        netContents: "750 mL",
        unreadable: ["netContents"],
        effects: { cropBottom: 150, rotate: 1.5, grain: true },
      },
      { warning: WARNING, effects: { rotate: -1, grain: true } },
    ],
    expected: {
      overall: "needs_review",
      verdicts: { net_contents: "unreadable" },
    },
  },
  {
    application: {
      application_id: "APP-029",
      beverage_type: "malt",
      brand_name: "Gristmill",
      class_type: "Amber Ale",
      abv: 5.6,
      net_contents: "12 fl oz",
    },
    note: "Realism: sun-faded label with washed-out low-contrast print — still legible end to end. Pass.",
    style: "modern",
    sides: [
      {
        brandName: "Gristmill",
        classType: "Amber Ale",
        alcohol: "5.6 percent alcohol by volume",
        netContents: "12 FL. OZ.",
        effects: { faded: true, grain: true, vignette: true },
      },
      {
        warning: WARNING,
        effects: { faded: true, grain: true, vignette: true },
      },
    ],
    expected: { overall: "pass", verdicts: {} },
  },
  {
    application: {
      application_id: "APP-030",
      beverage_type: "spirits",
      brand_name: "Castle Peak",
      class_type: "American Single Malt Whiskey",
      abv: 43,
      net_contents: "750 mL",
    },
    note: "Realism perception case: a blown-out glare hotspot sits over the government warning → ❓, never a guess.",
    style: "dark",
    sides: [
      {
        brandName: "Castle Peak",
        classType: "American Single Malt Whiskey",
        alcohol: "Alc. 43% by Vol.",
        proof: "86 Proof",
        netContents: "750 mL",
        effects: { curvature: true, glare: true, grain: true },
      },
      {
        warning: WARNING,
        unreadable: ["warning"],
        effects: { glareOver: "warning", curvature: true, glare: true, grain: true },
      },
    ],
    expected: {
      overall: "needs_review",
      verdicts: { government_warning: "unreadable" },
    },
  },
  {
    application: {
      application_id: "APP-031",
      beverage_type: "spirits",
      brand_name: "Hollow Creek",
      class_type: "Kentucky Straight Bourbon Whiskey",
      abv: 45,
      net_contents: "750 mL",
    },
    note: "Extraneous-text decoys: ages, batch/barrel numbers, founding years, a street address containing 750, and an ounce serving suggestion — none of it a regulated field. Clean pass.",
    style: "classic",
    sides: [
      {
        brandName: "Hollow Creek",
        classType: "Kentucky Straight Bourbon Whiskey",
        alcohol: "Alc. 45% by Vol.",
        proof: "90 Proof",
        netContents: "750 mL",
        extraText: [
          "AGED 12 YEARS IN CHARRED OAK · BATCH No. 86 · BARREL 47",
          "EST. 1897 · FAMILY OWNED SINCE 1924",
        ],
      },
      {
        warning: WARNING,
        extraText: [
          "DISTILLED AND BOTTLED BY HOLLOW CREEK DISTILLING CO.",
          "750 MAIN STREET, BARDSTOWN, KENTUCKY",
          "BEST ENJOYED AS A 2 OZ POUR, NEAT OR OVER ICE",
        ],
      },
    ],
    expected: { overall: "pass", verdicts: {} },
  },
  {
    application: {
      application_id: "APP-032",
      beverage_type: "spirits",
      brand_name: "Pale Harbor",
      class_type: "Dry Gin",
      abv: 44,
      net_contents: "750 mL",
    },
    note: "Failure case for ink contrast: tone-on-tone print — the big brand survives, the fine print doesn't → ❓ for everything else.",
    style: "modern",
    sides: [
      {
        brandName: "Pale Harbor",
        classType: "Dry Gin",
        alcohol: "Alc. 44% by Vol.",
        netContents: "750 mL",
        unreadable: ["classType", "alcohol", "netContents"],
        effects: { ghostInk: true, grain: true },
      },
      {
        warning: WARNING,
        unreadable: ["warning"],
        effects: { ghostInk: true, grain: true },
      },
    ],
    expected: {
      overall: "needs_review",
      verdicts: {
        class_type: "unreadable",
        alcohol_content: "unreadable",
        net_contents: "unreadable",
        government_warning: "unreadable",
        same_field_of_vision: "unreadable",
      },
    },
  },
  {
    application: {
      application_id: "APP-033",
      beverage_type: "spirits",
      brand_name: "Kestrel",
      class_type: "Straight Rye Whiskey",
      abv: 41,
      net_contents: "750 mL",
    },
    note: "Failure case for focus: the front photo is badly out of focus — only the large brand survives; the sharp back still reads.",
    style: "classic",
    sides: [
      {
        brandName: "Kestrel",
        classType: "Straight Rye Whiskey",
        alcohol: "Alc. 41% by Vol.",
        netContents: "750 mL",
        unreadable: ["classType", "alcohol", "netContents"],
        effects: { focusBlur: 7, grain: true, rotate: 2 },
      },
      { warning: WARNING, effects: { grain: true, rotate: -1.5 } },
    ],
    expected: {
      overall: "needs_review",
      verdicts: {
        class_type: "unreadable",
        alcohol_content: "unreadable",
        net_contents: "unreadable",
        same_field_of_vision: "unreadable",
      },
    },
  },
  {
    application: {
      application_id: "APP-034",
      beverage_type: "wine",
      brand_name: "Norwood Cellars",
      class_type: "Merlot",
      abv: 13.5,
      net_contents: "750 mL",
    },
    note: "Failure case for exposure: a badly underexposed cellar shot — nothing on either side can be read → ❓ across the board.",
    style: "dark",
    sides: [
      {
        brandName: "Norwood Cellars",
        classType: "Merlot",
        alcohol: "Alcohol 13.5% by Volume",
        netContents: "750 mL",
        unreadable: ["brandName", "classType", "alcohol", "netContents"],
        effects: { exposure: 0.3, vignette: true, grain: true },
      },
      {
        warning: WARNING,
        unreadable: ["warning"],
        effects: { exposure: 0.3, vignette: true, grain: true },
      },
    ],
    expected: {
      overall: "needs_review",
      verdicts: {
        brand_name: "unreadable",
        class_type: "unreadable",
        alcohol_content: "unreadable",
        net_contents: "unreadable",
        government_warning: "unreadable",
      },
    },
  },

  // ——— Content failures rounding out the engine's mismatch paths ———

  {
    application: {
      application_id: "APP-035",
      beverage_type: "spirits",
      brand_name: "Saddle Ridge",
      class_type: "Vodka",
      abv: 40,
      net_contents: "750 mL",
    },
    note: "Seeded error: spirits label omits the alcohol statement entirely (no alc/vol, no proof) — it is required for spirits (§5.65).",
    style: "modern",
    sides: [
      {
        brandName: "Saddle Ridge",
        classType: "Vodka",
        netContents: "750 mL",
      },
      { warning: WARNING },
    ],
    expected: {
      overall: "fail",
      verdicts: {
        alcohol_content: "mismatch",
        same_field_of_vision: "unreadable",
      },
    },
  },
  {
    application: {
      application_id: "APP-036",
      beverage_type: "spirits",
      brand_name: "Twin Pines",
      class_type: "Straight Bourbon Whiskey",
      abv: 46,
      net_contents: "750 mL",
    },
    note: "Seeded error: the government warning is paraphrased and abridged — §16.21 requires the exact wording, no paraphrasing.",
    style: "classic",
    sides: [
      {
        brandName: "Twin Pines",
        classType: "Straight Bourbon Whiskey",
        alcohol: "Alc. 46% by Vol.",
        proof: "92 Proof",
        netContents: "750 mL",
      },
      {
        warning: {
          text: "GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcohol during pregnancy due to the risk of birth defects. (2) Drinking impairs your ability to drive a car or operate machinery and may cause health problems.",
        },
      },
    ],
    expected: { overall: "fail", verdicts: { government_warning: "mismatch" } },
  },
  {
    application: {
      application_id: "APP-037",
      beverage_type: "spirits",
      brand_name: "Red Lantern",
      class_type: "White Rum",
      abv: 40,
      net_contents: "750 mL",
    },
    note: "Seeded error: spirits label states net contents only in US customary units (25.4 FL. OZ.); metric is required (§5.70) — the mirror of APP-013's malt error.",
    style: "dark",
    sides: [
      {
        brandName: "Red Lantern",
        classType: "White Rum",
        alcohol: "Alc. 40% by Vol.",
        proof: "80 Proof",
        netContents: "25.4 FL. OZ.",
      },
      { warning: WARNING },
    ],
    expected: { overall: "fail", verdicts: { net_contents: "mismatch" } },
  },
  {
    application: {
      application_id: "APP-038",
      beverage_type: "spirits",
      brand_name: "Coyote Flats",
      class_type: "Tennessee Whiskey",
      abv: 41,
      net_contents: "750 mL",
    },
    note: "Seeded error: spirits label states alcohol content as a range (40–43%); only wine may state a range (§4.36).",
    style: "vintage",
    sides: [
      {
        brandName: "Coyote Flats",
        classType: "Tennessee Whiskey",
        alcohol: "Alcohol 40% to 43% by Volume",
        netContents: "750 mL",
      },
      { warning: WARNING },
    ],
    expected: { overall: "fail", verdicts: { alcohol_content: "mismatch" } },
  },
  {
    application: {
      application_id: "APP-039",
      beverage_type: "spirits",
      brand_name: "Marble Arch",
      class_type: "London Dry Gin",
      abv: 47,
      net_contents: "750 mL",
    },
    note: 'Seeded error: standalone class/type mismatch — label says "Navy Strength Gin", application says "London Dry Gin" (beyond OCR noise, unlike APP-018).',
    style: "classic",
    sides: [
      {
        brandName: "Marble Arch",
        classType: "Navy Strength Gin",
        alcohol: "Alc. 47% by Vol.",
        proof: "94 Proof",
        netContents: "750 mL",
      },
      { warning: WARNING },
    ],
    expected: { overall: "fail", verdicts: { class_type: "mismatch" } },
  },

  // ——— Varied correct labels (extractor false-positive baseline) ———

  {
    application: {
      application_id: "APP-040",
      beverage_type: "wine",
      brand_name: "Belle Saison",
      class_type: "Brut Sparkling Wine",
      abv: 12,
      net_contents: "750 mL",
    },
    note: "Correct varied: script-face sparkling wine with decoy cuvée/year small print. Pass.",
    style: "script",
    sides: [
      {
        brandName: "Belle Saison",
        classType: "Brut Sparkling Wine",
        alcohol: "Alcohol 12% by Volume",
        netContents: "750 mL",
        extraText: ["MÉTHODE TRADITIONNELLE · CUVÉE No. 7 · DISGORGED 2024"],
      },
      {
        warning: WARNING,
        extraText: ["PRODUCED AND BOTTLED BY BELLE SAISON WINE CO., SONOMA, CALIFORNIA"],
      },
    ],
    expected: { overall: "pass", verdicts: {} },
  },
  {
    application: {
      application_id: "APP-041",
      beverage_type: "spirits",
      brand_name: "Copperline",
      class_type: "Apple Brandy",
      abv: 43,
      net_contents: "750 mL",
    },
    note: "Correct varied: single-image spirits label with everything — warning included — on the front (§5.63 satisfied on one side). Pass.",
    style: "craft",
    sides: [
      {
        brandName: "Copperline",
        classType: "Apple Brandy",
        alcohol: "Alc. 43% by Vol.",
        proof: "86 Proof",
        netContents: "750 mL",
        warning: WARNING,
      },
    ],
    expected: { overall: "pass", verdicts: {} },
  },
  {
    application: {
      application_id: "APP-042",
      beverage_type: "malt",
      brand_name: "Half Hitch",
      class_type: "Hazy India Pale Ale",
      abv: 6.8,
      net_contents: "16 fl oz",
    },
    note: 'Correct varied: single-image can using the abbreviated "Alc. X% by Vol." form on a malt beverage. Pass.',
    style: "modern",
    sides: [
      {
        brandName: "Half Hitch",
        classType: "Hazy India Pale Ale",
        alcohol: "Alc. 6.8% by Vol.",
        netContents: "16 FL. OZ.",
        warning: WARNING,
        extraText: ["BREWED AND CANNED BY HALF HITCH BREWING CO. · POURS BEST AT 45°F"],
      },
    ],
    expected: { overall: "pass", verdicts: {} },
  },
  {
    application: {
      application_id: "APP-043",
      beverage_type: "wine",
      brand_name: "Foxglove",
      class_type: "White Zinfandel",
      abv: 10.5,
      net_contents: "750 mL",
    },
    note: "Correct varied: wine with the alcohol range stated on the back label — wine has no field-of-vision rule, so the split is legal. Pass.",
    style: "vintage",
    sides: [
      {
        brandName: "Foxglove",
        classType: "White Zinfandel",
        netContents: "750 mL",
      },
      {
        alcohol: "Alcohol 9.5% to 11.5% by Volume",
        warning: WARNING,
      },
    ],
    expected: { overall: "pass", verdicts: {} },
  },
  {
    application: {
      application_id: "APP-044",
      beverage_type: "spirits",
      brand_name: "Quarter Moon",
      class_type: "Blanco Tequila",
      abv: 40,
      net_contents: "1 L",
    },
    note: "Correct varied: liter bottle with dual-unit net contents and decoy year/batch small print. Pass.",
    style: "dark",
    sides: [
      {
        brandName: "Quarter Moon",
        classType: "Blanco Tequila",
        alcohol: "Alc. 40% by Vol.",
        proof: "80 Proof",
        netContents: "1 L (33.8 FL. OZ.)",
        extraText: ["EST. 1942 · SMALL BATCH No. 12 · AGAVE HARVESTED AT 8 YEARS"],
      },
      { warning: WARNING },
    ],
    expected: { overall: "pass", verdicts: {} },
  },
  {
    application: {
      application_id: "APP-045",
      beverage_type: "wine",
      brand_name: "Lark & Vine",
      class_type: "Chardonnay",
      abv: 13,
      net_contents: "750 mL",
    },
    note: "Correct varied: handheld photo (tilt, grain, vignette) of an ordinary chardonnay — everything legible. Pass.",
    style: "script",
    sides: [
      {
        brandName: "Lark & Vine",
        classType: "Chardonnay",
        alcohol: "Alcohol 13% by Volume",
        netContents: "750 mL",
        effects: { rotate: -2, grain: true, vignette: true },
      },
      { warning: WARNING, effects: { rotate: 1.5, grain: true, vignette: true } },
    ],
    expected: { overall: "pass", verdicts: {} },
  },
  {
    application: {
      application_id: "APP-046",
      beverage_type: "spirits",
      brand_name: "Gull Point",
      class_type: "Single Malt Whiskey",
      abv: 46,
      net_contents: "750 mL",
    },
    note: "Correct varied: curved bottle shot with glare and grain — a second cylindrical pass case in a different style. Pass.",
    style: "classic",
    sides: [
      {
        brandName: "Gull Point",
        classType: "Single Malt Whiskey",
        alcohol: "Alc. 46% by Vol.",
        proof: "92 Proof",
        netContents: "750 mL",
        effects: { curvature: true, glare: true, grain: true },
      },
      {
        warning: WARNING,
        effects: { curvature: true, glare: true, grain: true },
      },
    ],
    expected: { overall: "pass", verdicts: {} },
  },
  {
    application: {
      application_id: "APP-047",
      beverage_type: "malt",
      brand_name: "North Pier",
      class_type: "Porter",
      abv: 5.8,
      net_contents: "12 fl oz",
    },
    note: "Correct varied: malt beverage legally omitting its optional alcohol content, on the colored craft style. Pass.",
    style: "craft",
    sides: [
      {
        brandName: "North Pier",
        classType: "Porter",
        netContents: "12 FL. OZ.",
        extraText: ["DARK ROASTED MALT · BOTTLED ON THE WATERFRONT SINCE 1987"],
      },
      { warning: WARNING },
    ],
    expected: { overall: "pass", verdicts: {} },
  },
  {
    application: {
      application_id: "APP-048",
      beverage_type: "wine",
      brand_name: "Millbrook",
      class_type: "Red Table Wine",
      abv: 11.5,
      net_contents: "750 mL",
    },
    note: "Correct varied: single-image table wine legally omitting alcohol content (§4.36), warning on the front. Pass.",
    style: "vintage",
    sides: [
      {
        brandName: "Millbrook",
        classType: "Red Table Wine",
        netContents: "750 mL",
        warning: WARNING,
      },
    ],
    expected: { overall: "pass", verdicts: {} },
  },
  {
    application: {
      application_id: "APP-049",
      beverage_type: "spirits",
      brand_name: "Verity",
      class_type: "Straight Wheat Whiskey",
      abv: 45,
      net_contents: "750 mL",
    },
    note: "Correct varied: spirits stating alc/vol without a proof line (proof is optional), with decoy age/year small print. Pass.",
    style: "script",
    sides: [
      {
        brandName: "Verity",
        classType: "Straight Wheat Whiskey",
        alcohol: "Alc. 45% by Vol.",
        netContents: "750 mL",
        extraText: ["AGED 7 YEARS · BOTTLE 214 OF 1200 · DISTILLED IN 2018"],
      },
      { warning: WARNING },
    ],
    expected: { overall: "pass", verdicts: {} },
  },

  // ——— Subtle content errors — legible, minor, easy to autocorrect ———

  {
    application: {
      application_id: "APP-050",
      beverage_type: "spirits",
      brand_name: "Birchwood",
      class_type: "Straight Bourbon Whiskey",
      abv: 45,
      net_contents: "750 mL",
    },
    note: "Subtle seeded error: label states 44.5% (89 proof, internally consistent) against the application's 45% — a half-point delta on a curved, glared bottle. An extractor that rounds or autocorrects will miss it.",
    style: "classic",
    sides: [
      {
        brandName: "Birchwood",
        classType: "Straight Bourbon Whiskey",
        alcohol: "Alc. 44.5% by Vol.",
        proof: "89 Proof",
        netContents: "750 mL",
        effects: { curvature: true, glare: true, grain: true },
      },
      { warning: WARNING, effects: { curvature: true, glare: true, grain: true } },
    ],
    expected: { overall: "fail", verdicts: { alcohol_content: "mismatch" } },
  },
  {
    application: {
      application_id: "APP-051",
      beverage_type: "spirits",
      brand_name: "Tidewater",
      class_type: "Spiced Rum",
      abv: 45.5,
      net_contents: "750 mL",
    },
    note: "Subtle seeded error: the alc/vol statement matches the application (45.5%) but the proof line reads 93 instead of 91 — a two-digit slip an extractor must transcribe faithfully to catch.",
    style: "modern",
    sides: [
      {
        brandName: "Tidewater",
        classType: "Spiced Rum",
        alcohol: "Alc. 45.5% by Vol.",
        proof: "93 Proof",
        netContents: "750 mL",
      },
      { warning: WARNING },
    ],
    expected: { overall: "fail", verdicts: { alcohol_content: "mismatch" } },
  },
  {
    application: {
      application_id: "APP-052",
      beverage_type: "wine",
      brand_name: "Harvest Gate",
      class_type: "Merlot",
      abv: 13,
      net_contents: "750 mL",
    },
    note: 'Subtle seeded error: the warning drops a single word — "drive a car or machinery" instead of "drive a car or operate machinery". Verbatim means verbatim.',
    style: "vintage",
    sides: [
      {
        brandName: "Harvest Gate",
        classType: "Merlot",
        alcohol: "Alcohol 13% by Volume",
        netContents: "750 mL",
      },
      {
        warning: {
          text: GOVERNMENT_WARNING.replace(
            "drive a car or operate machinery",
            "drive a car or machinery",
          ),
        },
      },
    ],
    expected: { overall: "fail", verdicts: { government_warning: "mismatch" } },
  },
  {
    application: {
      application_id: "APP-053",
      beverage_type: "malt",
      brand_name: "Stillwater Flats",
      class_type: "Lager",
      abv: 4.8,
      net_contents: "12 fl oz",
    },
    note: 'Subtle seeded error: one substituted word in the warning — "should not drink alcohol during pregnancy" instead of "alcoholic beverages". An extractor that paraphrases from memory will read right past it.',
    style: "craft",
    sides: [
      {
        brandName: "Stillwater Flats",
        classType: "Lager",
        alcohol: "4.8 percent alcohol by volume",
        netContents: "12 FL. OZ.",
      },
      {
        warning: {
          text: GOVERNMENT_WARNING.replace(
            "should not drink alcoholic beverages during pregnancy",
            "should not drink alcohol during pregnancy",
          ),
        },
      },
    ],
    expected: { overall: "fail", verdicts: { government_warning: "mismatch" } },
  },
  {
    application: {
      application_id: "APP-054",
      beverage_type: "spirits",
      brand_name: "Pocket Watch",
      class_type: "Peach Brandy",
      abv: 35,
      net_contents: "375 mL",
    },
    note: "Subtle seeded error: half-bottle stating 350 mL against the application's 375 mL — a one-digit difference in small print.",
    style: "dark",
    sides: [
      {
        brandName: "Pocket Watch",
        classType: "Peach Brandy",
        alcohol: "Alc. 35% by Vol.",
        proof: "70 Proof",
        netContents: "350 mL",
      },
      { warning: WARNING },
    ],
    expected: { overall: "fail", verdicts: { net_contents: "mismatch" } },
  },
];

/** Resolve a case's label sides, following `imagesFrom` indirection. */
export function resolveSides(c: FixtureCase): LabelSideSpec[] {
  if (c.sides) return c.sides;
  const source = FIXTURE_CASES.find(
    (other) => other.application.application_id === c.imagesFrom,
  );
  if (!source?.sides) {
    throw new Error(
      `${c.application.application_id}: imagesFrom "${c.imagesFrom}" doesn't resolve to a case with sides`,
    );
  }
  return source.sides;
}

/** Image filenames for a case, in side order — the CSV's `image_files`. */
export function imageFiles(c: FixtureCase): string[] {
  const owner = c.sides ? c.application.application_id : c.imagesFrom!;
  const stem = owner.toLowerCase();
  return resolveSides(c).map(
    (_, i) => `${stem}-${i === 0 ? "front" : "back"}.png`,
  );
}
