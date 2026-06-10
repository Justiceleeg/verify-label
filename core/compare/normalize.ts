// Text and value normalization — pure functions feeding the matchers.

/** Collapse whitespace runs to single spaces and trim. */
export function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/**
 * Aggressive normalization for fuzzy text compares: case-fold, fold
 * diacritics, strip punctuation, collapse whitespace.
 */
export function normalizeLoose(s: string): string {
  return normalizeWhitespace(
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/\p{M}/gu, "")
      .replace(/['’]/g, "") // apostrophes vanish: "stone's" → "stones"
      .replace(/[^\p{L}\p{N}]+/gu, " "),
  );
}

/** Levenshtein edit distance — used to spot OCR-noise-sized differences. */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = curr;
  }
  return prev[b.length];
}

const ML_PER_UNIT: Record<string, number> = { ml: 1, cl: 10, l: 1000 };

/**
 * Parse a net-contents statement to milliliters. Metric only (mL/cL/L);
 * returns null if no metric quantity is found.
 */
export function parseNetContents(s: string): number | null {
  const m = s.match(
    /(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)\s*(millilit(?:er|re)s?|centilit(?:er|re)s?|lit(?:er|re)s?|ml|cl|l)\b/i,
  );
  if (!m) return null;
  const value = parseFloat(m[1].replace(/,/g, ""));
  const unit = m[2].toLowerCase();
  const key = unit.startsWith("milli") ? "ml" : unit.startsWith("centi") ? "cl" : unit.startsWith("lit") ? "l" : unit;
  return value * ML_PER_UNIT[key];
}

const ML_PER_CUSTOMARY: Record<string, number> = {
  floz: 29.5735295625,
  pint: 473.176473,
  quart: 946.352946,
  gallon: 3785.411784,
};

/** Parse "1/2" fractions or plain decimals (with thousands separators). */
function parseQuantity(s: string): number {
  const frac = s.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (frac) return parseInt(frac[1], 10) / parseInt(frac[2], 10);
  return parseFloat(s.replace(/,/g, ""));
}

/**
 * Parse a US-customary net-contents statement to milliliters. Handles the
 * §7.70 forms — fl oz, pints, quarts, gallons, fractions, and compounds like
 * "1 PT. 8 FL. OZ." (parts are summed). Returns null if none found.
 */
export function parseCustomaryContents(s: string): number | null {
  const re =
    /(\d+\s*\/\s*\d+|\d+(?:\.\d+)?)\s*(fl\.?\s*oz\.?|fluid\s+ounces?|ounces?|oz\.?|pints?|pts?\.?|quarts?|qts?\.?|gallons?|gals?\.?)/gi;
  let total = 0;
  let found = false;
  for (const m of s.matchAll(re)) {
    found = true;
    const unit = m[2].toLowerCase();
    const key = /^(fl|fluid|oz|ounce)/.test(unit)
      ? "floz"
      : unit.startsWith("p")
        ? "pint"
        : unit.startsWith("q")
          ? "quart"
          : "gallon";
    total += parseQuantity(m[1]) * ML_PER_CUSTOMARY[key];
  }
  return found ? total : null;
}

export interface AlcoholStatement {
  /** % ABV. A single stated value has low === high. */
  low: number;
  high: number;
  /**
   * Whether the statement reads as a standard alc/vol form
   * ("Alc. 45% by Vol.", "45% alc/vol", "ALCOHOL 13.5% BY VOLUME", …).
   */
  formatValid: boolean;
}

/**
 * Parse an alcohol-content statement; null if no percentage is found.
 * Accepts the % symbol or "percent" spelled out (§5.65(b)(2)(i)).
 */
export function parseAlcoholStatement(s: string): AlcoholStatement | null {
  const range = s.match(
    /(\d+(?:\.\d+)?)\s*(?:%|percent\b)?\s*(?:-|–|—|\bto\b)\s*(\d+(?:\.\d+)?)\s*(?:%|percent\b)/i,
  );
  const single = range ? null : s.match(/(\d+(?:\.\d+)?)\s*(?:%|percent\b)/i);
  if (!range && !single) return null;
  const low = parseFloat((range ?? single)![1]);
  const high = range ? parseFloat(range[2]) : low;
  const formatValid = /alc/i.test(s) && /vol/i.test(s);
  return { low: Math.min(low, high), high: Math.max(low, high), formatValid };
}

/** Parse a proof statement, e.g. "90 Proof" → 90; null if absent. */
export function parseProof(s: string): number | null {
  const m = s.match(/(\d+(?:\.\d+)?)\s*proof\b/i);
  return m ? parseFloat(m[1]) : null;
}
