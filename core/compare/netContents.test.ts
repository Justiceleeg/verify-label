import { describe, expect, it } from "vitest";
import { compareNetContents } from "./netContents";
import { application, field } from "./testHelpers";

const spirits = (net: string) => application({ net_contents: net });
const malt = (net: string) =>
  application({ beverage_type: "malt", abv: 5, class_type: "Lager", net_contents: net });

describe("compareNetContents — metric beverages (spirits/wine, §5.70/§4.37)", () => {
  it("exact match → match", () => {
    expect(compareNetContents(spirits("750 mL"), field("750 mL")).status).toBe("match");
  });

  it("mL/L normalization: 1.75 L matches 1750 mL", () => {
    const v = compareNetContents(spirits("1750 mL"), field("1.75 L"));
    expect(v.status).toBe("match");
    expect(v.explanation).toContain("1750 mL");
  });

  it("dual statement with metric present → match", () => {
    expect(
      compareNetContents(spirits("750 mL"), field("750 mL (25.4 FL OZ)")).status,
    ).toBe("match");
  });

  it("wrong net contents → mismatch (seeded-error case)", () => {
    const v = compareNetContents(spirits("750 mL"), field("700 mL"));
    expect(v.status).toBe("mismatch");
    expect(v.explanation).toContain("700 mL");
    expect(v.explanation).toContain("750 mL");
  });

  it("non-metric only on a spirits label → mismatch", () => {
    const v = compareNetContents(spirits("750 mL"), field("25.4 FL OZ"));
    expect(v.status).toBe("mismatch");
    expect(v.explanation).toMatch(/metric/i);
  });
});

describe("compareNetContents — malt beverages (§7.70: US customary required)", () => {
  it("fl oz matching the application → match", () => {
    expect(compareNetContents(malt("12 fl oz"), field("12 FL. OZ.")).status).toBe("match");
  });

  it("metric-only on a malt label → mismatch, even if the quantity agrees", () => {
    const v = compareNetContents(malt("12 fl oz"), field("355 mL"));
    expect(v.status).toBe("mismatch");
    expect(v.explanation).toMatch(/fl\. oz\.|US measure/i);
  });

  it("customary plus supplemental metric → match", () => {
    expect(
      compareNetContents(malt("12 fl oz"), field("12 FL OZ (355 mL)")).status,
    ).toBe("match");
  });

  it("metric application value cross-checks against a fl oz label", () => {
    expect(compareNetContents(malt("355 mL"), field("12 FL OZ")).status).toBe("match");
  });

  it("compound pints + fl oz statements parse and compare", () => {
    expect(compareNetContents(malt("24 fl oz"), field("1 PT. 8 FL. OZ.")).status).toBe(
      "match",
    );
  });

  it("wrong quantity → mismatch", () => {
    const v = compareNetContents(malt("12 fl oz"), field("16 FL OZ"));
    expect(v.status).toBe("mismatch");
  });
});

describe("compareNetContents — dual-statement internal consistency", () => {
  it("supplement contradicting the primary → mismatch, even when the primary matches the application", () => {
    const v = compareNetContents(spirits("750 mL"), field("750 mL (12 FL. OZ.)"));
    expect(v.status).toBe("mismatch");
    expect(v.explanation).toMatch(/contradicts itself/i);
  });

  it("contradictory dual statement on a malt label → mismatch", () => {
    const v = compareNetContents(malt("12 fl oz"), field("12 FL OZ (500 mL)"));
    expect(v.status).toBe("mismatch");
    expect(v.explanation).toMatch(/contradicts itself/i);
  });

  it("rounded-but-consistent dual statement is not flagged", () => {
    expect(
      compareNetContents(spirits("1 L"), field("1 L (33.8 FL. OZ.)")).status,
    ).toBe("match");
  });
});

describe("compareNetContents — degenerate inputs", () => {
  it("unparseable label text → probable match for human review", () => {
    expect(compareNetContents(spirits("750 mL"), field("seven fifty")).status).toBe(
      "probable_match",
    );
  });

  it("confidently absent → mismatch", () => {
    expect(compareNetContents(spirits("750 mL"), field(null, "high")).status).toBe(
      "mismatch",
    );
  });

  it("unreadable → unreadable", () => {
    expect(compareNetContents(spirits("750 mL"), field(null, "low")).status).toBe(
      "unreadable",
    );
  });

  it("bad application data → probable match, pointing at the application", () => {
    const v = compareNetContents(spirits("a fifth"), field("750 mL"));
    expect(v.status).toBe("probable_match");
    expect(v.explanation).toMatch(/application/i);
  });
});
