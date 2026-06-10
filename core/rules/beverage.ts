// Beverage-type rules — which checks apply per spirits / wine / malt.
// Citations: 27 CFR §4.36 (wine), §5.63/§5.65 (spirits), §7.65 (malt).

import type { ApplicationData, BeverageType } from "../types";

/**
 * Whether the label must state alcohol content.
 * - Spirits: always required (§5.65).
 * - Wine ≤14% ABV designated "table wine"/"light wine" may omit it (§4.36).
 * - Malt: optional, except flavored malt beverages (alcohol from added
 *   nonbeverage flavors), where it is mandatory (§7.65). The application CSV
 *   carries no formulation data, so "flavored" is inferred from class/type.
 */
export function alcoholContentRequired(app: ApplicationData): boolean {
  switch (app.beverage_type) {
    case "spirits":
      return true;
    case "wine":
      return !(app.abv <= 14 && /\b(table|light)\s+wine\b/i.test(app.class_type));
    case "malt":
      return /\bflavored\b/i.test(app.class_type);
  }
}

/** Only wine may state alcohol content as a range (§4.36). */
export function allowsAbvRange(type: BeverageType): boolean {
  return type === "wine";
}

/**
 * §4.36: max width of a stated wine ABV range, in percentage points —
 * 2 points for wines over 14% ABV, 3 points at 14% or under.
 */
export function wineRangeMaxWidth(abv: number): number {
  return abv > 14 ? 2 : 3;
}

/**
 * §5.63: spirits must show brand name, class/type, and alcohol content in the
 * same field of vision (same side of the container).
 */
export function requiresSameFieldOfVision(type: BeverageType): boolean {
  return type === "spirits";
}

export type NetContentsUnits = "metric" | "us_customary";

/**
 * Required net-contents units. Spirits and wine must be metric (mL/L), with
 * US customary only as a supplement (§5.70, §4.37). Malt beverages are the
 * reverse: US customary (fl oz / pints / quarts / gallons) is mandatory and
 * metric may appear "in addition to, but not in lieu of" it (§7.70).
 */
export function requiredNetContentsUnits(type: BeverageType): NetContentsUnits {
  return type === "malt" ? "us_customary" : "metric";
}
