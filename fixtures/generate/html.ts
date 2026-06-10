// Label spec → self-contained HTML document, screenshotted by index.ts.
// Programmatic rendering is the point: every character on the label is
// controlled, so seeded errors are exact (see docs/ARCHITECTURE.md,
// "Test fixtures"). Text is never transformed by CSS — what the spec says
// is literally what the image shows.

import type { BeverageType } from "../../core/types";
import type {
  EffectsSpec,
  LabelSideSpec,
  LabelStyle,
  UnreadableField,
} from "../cases";

/** Back-label filler prose. Deliberately free of anything field-like —
 * no quantities, percentages, or brand-shaped names. */
const BLURBS: Record<BeverageType, string> = {
  spirits:
    "Crafted in small batches, rested in charred oak, and bottled by hand. Share it slowly, with good company.",
  wine: "Grown on sun-washed hillside vines and cellared with patience. Pairs well with a long dinner and an open evening.",
  malt: "Brewed with whole-cone hops and a stubborn attention to detail. Keep it cold, pour it generously, enjoy it fresh.",
};

const STYLES: Record<LabelStyle, string> = {
  classic: `
    .label { background: #f6f0e1; color: #2b2118; border: 6px double #2b2118;
             font-family: Georgia, 'Times New Roman', serif; }
    .brand { font-family: Georgia, serif; }
    .rule { border-top: 2px solid #2b2118; }`,
  modern: `
    .label { background: #ffffff; color: #16181d; border: 2px solid #16181d;
             font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; }
    .brand { font-weight: 700; letter-spacing: 1px; }
    .rule { border-top: 1px solid #16181d; }`,
  dark: `
    .label { background: #15151a; color: #f0e8d8; border: 4px solid #c9a86a;
             font-family: Georgia, 'Times New Roman', serif; }
    .brand { color: #e8c87a; }
    .rule { border-top: 1px solid #c9a86a; }`,
  vintage: `
    .label { background: #efe3c8; color: #4a3220; border: 3px solid #4a3220;
             outline: 1px dashed #4a3220; outline-offset: -12px;
             font-family: Georgia, 'Times New Roman', serif; }
    .brand { font-style: italic; }
    .rule { border-top: 2px dotted #4a3220; }`,
  script: `
    .label { background: #f8f4ea; color: #2f3a2f; border: 2px solid #6b7c5e;
             font-family: Georgia, 'Times New Roman', serif; }
    .brand { font-family: 'Snell Roundhand', 'Apple Chancery', cursive;
             font-weight: 400; font-size: 66px; }
    .rule { border-top: 1px solid #6b7c5e; }`,
  craft: `
    .label { background: #1f4e4a; color: #f2e8d5; border: 5px solid #f2e8d5;
             font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; }
    .brand { font-weight: 800; letter-spacing: 3px; font-size: 50px; }
    .rule { border-top: 3px solid #e07a3f; }`,
};

const BASE_CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #888; display: flex; justify-content: center; padding: 20px; }
  .label {
    width: 700px; height: 900px; padding: 56px 48px;
    display: flex; flex-direction: column; align-items: center;
    text-align: center; gap: 28px;
  }
  .rule { width: 220px; }
  .brand { font-size: 58px; line-height: 1.1; }
  .class-type { font-size: 27px; letter-spacing: 2px; }
  .alcohol { font-size: 26px; }
  .proof { font-size: 24px; }
  .blurred { filter: blur(9px); }
  /* Brand type is ~2× the size of other fields; the unreadability blur
   * must scale with it or large letterforms stay guessable. */
  .brand.blurred { filter: blur(18px); }
  .blurb { font-size: 21px; line-height: 1.5; max-width: 520px; font-style: italic; }
  .warning { font-size: 19px; line-height: 1.45; text-align: left; max-width: 560px; margin-top: 12px; }
  .net { font-size: 24px; letter-spacing: 1px; margin-top: auto; }
  .extra { font-size: 14.5px; line-height: 1.6; letter-spacing: .5px; opacity: .9; }
`;

// Photo-realism layer (EffectsSpec). The label's text rendering is exactly
// the flat version; effects are transforms, filters, and translucent
// overlays around it. Alphas are deliberately low — fields a case expects
// to be readable must survive the effects (vetted by eye on regenerate).
//
// Tiled film-grain texture via SVG feTurbulence, inlined as a data URI.
const GRAIN_URI =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='280' height='280'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='280' height='280' filter='url(%23n)'/%3E%3C/svg%3E";

const EFFECTS_CSS = `
  .scene {
    position: relative; width: 820px; height: 1020px; overflow: hidden;
    display: flex; align-items: center; justify-content: center;
    background: radial-gradient(ellipse at 50% 28%, #6e675c, #3b372f 65%, #242019);
  }
  .persp { perspective: 1100px; }
  .scene .label { position: relative; box-shadow: 0 24px 60px rgba(0,0,0,.55); }
  .warp {
    width: 700px; height: 900px;
    /* drop-shadow (not box-shadow) so the shadow hugs the bowed outline */
    filter: drop-shadow(0 22px 28px rgba(0,0,0,.5));
  }
  .fx { position: absolute; inset: 0; pointer-events: none; }
  .fx-curve {
    background:
      linear-gradient(90deg, rgba(0,0,0,.38), rgba(0,0,0,.12) 14%, transparent 26%,
        transparent 74%, rgba(0,0,0,.14) 86%, rgba(0,0,0,.42)),
      linear-gradient(90deg, transparent 30%, rgba(255,255,255,.05) 36%,
        rgba(255,255,255,.28) 41%, rgba(255,255,255,.08) 47%, transparent 54%);
  }
  .fx-glare {
    background:
      linear-gradient(112deg, transparent 38%, rgba(255,255,255,.22) 44%,
        rgba(255,255,255,.07) 49%, transparent 54%),
      linear-gradient(105deg, transparent 60%, rgba(255,255,255,.15) 66%, transparent 72%);
  }
  .fx-dirt {
    background:
      radial-gradient(circle 5px at 13% 21%, rgba(48,38,26,.55), transparent 70%),
      radial-gradient(circle 3px at 31% 67%, rgba(48,38,26,.5), transparent 70%),
      radial-gradient(circle 4px at 72% 33%, rgba(48,38,26,.45), transparent 70%),
      radial-gradient(circle 6px at 86% 79%, rgba(48,38,26,.5), transparent 70%),
      radial-gradient(circle 3px at 55% 90%, rgba(48,38,26,.45), transparent 70%),
      radial-gradient(circle 4px at 44% 12%, rgba(48,38,26,.4), transparent 70%);
  }
  .scene-vignette {
    position: absolute; inset: 0; pointer-events: none;
    background: radial-gradient(ellipse at 50% 45%, transparent 52%,
      rgba(8,6,4,.38) 82%, rgba(8,6,4,.6));
  }
  .scene-grain {
    position: absolute; inset: 0; pointer-events: none; opacity: .16;
    background-image: url("${GRAIN_URI}"); background-size: 280px 280px;
  }
  .alcohol-wrap { position: relative; }
  .smudge {
    position: absolute; left: 50%; top: 50%; width: 380px; height: 170px;
    transform: translate(-50%, -20%) rotate(-4deg);
    border-radius: 48% 52% 55% 45% / 55% 48% 52% 45%;
    backdrop-filter: blur(10px);
    /* Translucent enough that a smear of the (already blurred) text shows
     * through — "something is printed here" must read, the text must not.
     * Kept low and barely tilted so it clears the class/type line above. */
    background: radial-gradient(ellipse at 45% 45%, rgba(214,208,196,.32),
      rgba(214,208,196,.14) 55%, rgba(214,208,196,.04) 75%, transparent);
  }
  /* Tone-on-tone "designer" print: everything but the brand in barely-there
   * ink. Faint letterforms should still be visible — printed, not absent. */
  .ghost .class-type, .ghost .alcohol, .ghost .proof, .ghost .net,
  .ghost .warning, .ghost .blurb, .ghost .extra, .ghost .rule { opacity: .2; }
  .warning-wrap { position: relative; }
  .glare-hotspot {
    position: absolute; inset: -52px -64px;
    border-radius: 50% / 42%;
    transform: rotate(-2deg);
    /* Self-blurred so the bloom has no hard edge — it should read as a
     * light source washing the text out, not a redaction bar. */
    filter: blur(9px);
    background: radial-gradient(closest-side ellipse at 52% 46%,
      rgba(255,255,255,.98) 35%, rgba(255,255,255,.85) 60%,
      rgba(255,255,255,.35) 82%, transparent);
    backdrop-filter: blur(7px);
  }
`;

/** CSS filter for the lighting/focus flags; frame transforms (tilt, bad
 * crop) are composed alongside it. */
function castStyle(fx: EffectsSpec): string {
  const filters: string[] = [];
  if (fx.dim) filters.push("brightness(.66)", "contrast(.92)", "saturate(.8)");
  else if (fx.vignette) filters.push("sepia(.22)", "saturate(.9)", "brightness(.94)", "contrast(1.05)");
  if (fx.faded) filters.push("contrast(.55)", "brightness(1.18)");
  if (fx.exposure !== undefined)
    filters.push(`brightness(${fx.exposure})`, "contrast(.9)");
  if (fx.focusBlur) filters.push(`blur(${fx.focusBlur}px)`);

  const transforms: string[] = [];
  // The label sits centered with 60px of scene slack below it, so hiding
  // N px of its bottom edge means shifting down by N + 60.
  if (fx.cropBottom) transforms.push(`translateY(${fx.cropBottom + 60}px)`);
  if (fx.rotate) transforms.push(`rotate(${fx.rotate}deg)`);

  const parts: string[] = [];
  if (filters.length) parts.push(`filter:${filters.join(" ")}`);
  if (transforms.length) parts.push(`transform:${transforms.join(" ")}`);
  return parts.join(";");
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function warningHtml(side: LabelSideSpec, blurClass: string): string {
  const w = side.warning!;
  const colon = w.text.indexOf(":");
  const heading = escapeHtml(w.text.slice(0, colon + 1));
  const remainder = escapeHtml(w.text.slice(colon + 1));
  const headingWeight = (w.headingBold ?? true) ? 700 : 400;
  const remainderWeight = (w.remainderBold ?? false) ? 700 : 400;
  return `<p class="warning${blurClass}"><span style="font-weight:${headingWeight}">${heading}</span><span style="font-weight:${remainderWeight}">${remainder}</span></p>`;
}

/** The label div with its content blocks and any label-surface overlays
 * (curve shading, glare, dirt, anchored smudge/hotspot) baked in. These
 * live on the label rather than the scene so the cylindrical warp bends
 * them along with the print. */
function labelDiv(
  side: LabelSideSpec,
  beverageType: BeverageType,
  opts: { shot: boolean; inlineStyle?: string },
): string {
  const fx = side.effects;
  // Fields declared unreadable render blurred — the guarantee that no
  // vetting pass or effect tweak can accidentally make them legible.
  const blur = (key: UnreadableField) =>
    side.unreadable?.includes(key) ? " blurred" : "";
  const blocks: string[] = [];

  if (side.brandName !== undefined) {
    blocks.push(
      `<h1 class="brand${blur("brandName")}">${escapeHtml(side.brandName)}</h1>`,
    );
    blocks.push(`<div class="rule"></div>`);
  } else {
    // Back labels lead with filler prose so the extractor has to pick the
    // regulated fields out of marketing copy.
    blocks.push(`<p class="blurb">${escapeHtml(BLURBS[beverageType])}</p>`);
  }
  if (side.classType !== undefined) {
    blocks.push(
      `<div class="class-type${blur("classType")}">${escapeHtml(side.classType)}</div>`,
    );
  }
  if (side.alcohol !== undefined) {
    const alcohol = `<div class="alcohol${blur("alcohol")}">${escapeHtml(side.alcohol)}</div>`;
    blocks.push(
      fx?.smudge === "alcohol"
        ? `<div class="alcohol-wrap">${alcohol}<div class="smudge"></div></div>`
        : alcohol,
    );
  }
  if (side.proof !== undefined) {
    blocks.push(`<div class="proof${blur("proof")}">${escapeHtml(side.proof)}</div>`);
  }
  if (side.warning !== undefined) {
    blocks.push(
      fx?.glareOver === "warning"
        ? `<div class="warning-wrap">${warningHtml(side, blur("warning"))}<div class="glare-hotspot"></div></div>`
        : warningHtml(side, blur("warning")),
    );
  }
  if (side.netContents !== undefined) {
    blocks.push(
      `<div class="net${blur("netContents")}">${escapeHtml(side.netContents)}</div>`,
    );
  }
  if (side.extraText?.length) {
    // Below the net contents when present; otherwise pushed to the label
    // bottom itself (address lines and the like live at the foot).
    const anchor = side.netContents === undefined ? ' style="margin-top:auto"' : "";
    blocks.push(
      `<div class="extra"${anchor}>${side.extraText
        .map((line) => `<div>${escapeHtml(line)}</div>`)
        .join("")}</div>`,
    );
  }

  if (fx?.curvature) blocks.push(`<div class="fx fx-curve"></div>`);
  if (fx?.glare) blocks.push(`<div class="fx fx-glare"></div>`);
  if (fx?.dirt) blocks.push(`<div class="fx fx-dirt"></div>`);

  const style = opts.inlineStyle ? ` style="${opts.inlineStyle}"` : "";
  return `<div class="label${fx?.ghostInk ? " ghost" : ""}${opts.shot ? " shot" : ""}"${style}>${blocks.join("\n")}</div>`;
}

function doc(style: LabelStyle, withEffects: boolean, body: string): string {
  return `<!doctype html>
<html><head><meta charset="utf-8"><style>${BASE_CSS}${STYLES[style]}${withEffects ? EFFECTS_CSS : ""}</style></head>
<body>${body}</body></html>`;
}

/** Scene wrapper shared by the one-pass effects render and the curved
 * pass 2: cast filters/transforms, optional perspective, scene overlays. */
function sceneBody(fx: EffectsSpec, subject: string, rotY: number): string {
  return `<div class="scene shot"><div class="cast" style="${castStyle(fx)}">${
    rotY ? `<div class="persp">${subject}</div>` : subject
  }</div>${fx.vignette ? `<div class="scene-vignette"></div>` : ""}${
    fx.grain ? `<div class="scene-grain"></div>` : ""
  }</div>`;
}

/** One-pass render. Curved sides need the two-pass pipeline instead
 * (renderCurvedLabelHtml → screenshot → renderCurvedSceneHtml). */
export function renderSideHtml(
  side: LabelSideSpec,
  style: LabelStyle,
  beverageType: BeverageType,
): string {
  const fx = side.effects;
  // `.shot` is what index.ts screenshots: the bare label normally, the
  // whole photographic scene when effects are on.
  if (!fx) return doc(style, false, labelDiv(side, beverageType, { shot: true }));

  const rotY = fx.angle ?? 0;
  const label = labelDiv(side, beverageType, {
    shot: false,
    inlineStyle: rotY ? `transform:rotateY(${rotY}deg) rotateX(1.2deg)` : undefined,
  });
  return doc(style, true, sceneBody(fx, label, rotY));
}

// Real cylindrical curvature is a pixel warp, not CSS: pass 1 renders the
// label flat (exact text, surface overlays included) for an element
// screenshot; pass 2 remaps those pixels onto a cylinder with a canvas —
// bowed top/bottom edges, horizontal compression toward the sides — and
// frames the result in the scene. index.ts drives the two passes.

/** Pass 1: the flat label, surface overlays included, for capture. */
export function renderCurvedLabelHtml(
  side: LabelSideSpec,
  style: LabelStyle,
  beverageType: BeverageType,
): string {
  return doc(style, true, labelDiv(side, beverageType, { shot: true }));
}

/** Pass 2: warp the captured label onto a cylinder, then apply the scene. */
export function renderCurvedSceneHtml(
  side: LabelSideSpec,
  style: LabelStyle,
  labelPngBase64: string,
): string {
  const fx = side.effects!;
  const rotY = fx.angle ?? 0;
  const canvas = `<canvas class="warp"${
    rotY ? ` style="transform:rotateY(${rotY}deg) rotateX(1.2deg)"` : ""
  }></canvas>`;

  // WRAP: total cylinder arc the label spans; SAG: how much shorter the
  // edge columns render — together they set how curved it reads.
  // IIFE: setContent renders via document.write, which keeps the global
  // lexical scope across renders — top-level consts would collide.
  const warpScript = `<script>(() => {
    const WRAP = 100 * Math.PI / 180, SAG = 0.08;
    const canvas = document.querySelector(".warp");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      const W = img.width, H = img.height;
      canvas.width = W; canvas.height = H;
      const half = WRAP / 2, sinHalf = Math.sin(half);
      // Destination column → cylinder angle → source column.
      const srcX = (x) => {
        const th = Math.asin(((x / W) * 2 - 1) * sinHalf);
        return ((th / half + 1) / 2) * W;
      };
      ctx.imageSmoothingQuality = "high";
      for (let x = 0; x < W; x++) {
        const s0 = srcX(x), s1 = srcX(x + 1);
        const th = Math.asin((((x + 0.5) / W) * 2 - 1) * sinHalf);
        const h = H * (1 - ((1 - Math.cos(th)) / (1 - Math.cos(half))) * SAG);
        ctx.drawImage(img, s0, 0, Math.max(s1 - s0, 0.5), H, x, (H - h) / 2, 1, h);
      }
      // Completion flag lives on the canvas, not window: window state can
      // survive setContent navigations and trip the next render's wait.
      canvas.dataset.warped = "1";
    };
    img.src = "data:image/png;base64,${labelPngBase64}";
  })()</script>`;

  return doc(style, true, sceneBody(fx, canvas, rotY) + warpScript);
}
