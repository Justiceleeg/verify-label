import { describe, expect, it } from "vitest";
import {
  alcoholContentRequired,
  allowsAbvRange,
  requiredNetContentsUnits,
  requiresSameFieldOfVision,
  wineRangeMaxWidth,
} from "./beverage";
import type { ApplicationData } from "../types";

function app(overrides: Partial<ApplicationData>): ApplicationData {
  return {
    application_id: "APP-001",
    beverage_type: "spirits",
    brand_name: "X",
    class_type: "Vodka",
    abv: 40,
    net_contents: "750 mL",
    ...overrides,
  };
}

describe("alcoholContentRequired", () => {
  it("spirits: always required", () => {
    expect(alcoholContentRequired(app({}))).toBe(true);
  });

  it("wine ≤14% designated table/light wine: optional", () => {
    expect(
      alcoholContentRequired(
        app({ beverage_type: "wine", abv: 12, class_type: "Red Table Wine" }),
      ),
    ).toBe(false);
    expect(
      alcoholContentRequired(
        app({ beverage_type: "wine", abv: 9, class_type: "Light Wine" }),
      ),
    ).toBe(false);
  });

  it("wine ≤14% without the designation: required", () => {
    expect(
      alcoholContentRequired(
        app({ beverage_type: "wine", abv: 12, class_type: "Sparkling Wine" }),
      ),
    ).toBe(true);
  });

  it("wine >14%: required even if called table wine", () => {
    expect(
      alcoholContentRequired(
        app({ beverage_type: "wine", abv: 15, class_type: "Red Table Wine" }),
      ),
    ).toBe(true);
  });

  it("malt: optional unless flavored", () => {
    expect(
      alcoholContentRequired(app({ beverage_type: "malt", abv: 5, class_type: "Lager" })),
    ).toBe(false);
    expect(
      alcoholContentRequired(
        app({ beverage_type: "malt", abv: 8, class_type: "Flavored Malt Beverage" }),
      ),
    ).toBe(true);
  });
});

describe("range and field-of-vision rules", () => {
  it("only wine may state a range", () => {
    expect(allowsAbvRange("wine")).toBe(true);
    expect(allowsAbvRange("spirits")).toBe(false);
    expect(allowsAbvRange("malt")).toBe(false);
  });

  it("wine range width: 2 points over 14%, 3 at or under", () => {
    expect(wineRangeMaxWidth(14)).toBe(3);
    expect(wineRangeMaxWidth(14.1)).toBe(2);
  });

  it("only spirits require same field of vision", () => {
    expect(requiresSameFieldOfVision("spirits")).toBe(true);
    expect(requiresSameFieldOfVision("wine")).toBe(false);
    expect(requiresSameFieldOfVision("malt")).toBe(false);
  });

  it("net contents: metric for spirits/wine (§5.70/§4.37), US customary for malt (§7.70)", () => {
    expect(requiredNetContentsUnits("spirits")).toBe("metric");
    expect(requiredNetContentsUnits("wine")).toBe("metric");
    expect(requiredNetContentsUnits("malt")).toBe("us_customary");
  });
});
