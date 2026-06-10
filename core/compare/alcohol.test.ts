import { describe, expect, it } from "vitest";
import { compareAlcohol } from "./alcohol";
import { application, field, labelFields } from "./testHelpers";

describe("compareAlcohol — spirits", () => {
  it("matching value with consistent proof → match", () => {
    const v = compareAlcohol(application(), labelFields());
    expect(v.status).toBe("match");
    expect(v.explanation).toMatch(/proof checks out/i);
  });

  it("matching value, no proof printed → match", () => {
    const v = compareAlcohol(
      application(),
      labelFields({ proof: field(null, "high") }),
    );
    expect(v.status).toBe("match");
  });

  it("wrong ABV → mismatch (seeded-error case)", () => {
    const v = compareAlcohol(
      application({ abv: 40 }),
      labelFields({ alcohol_content: field("Alc. 45% by Vol."), proof: field(null) }),
    );
    expect(v.status).toBe("mismatch");
    expect(v.explanation).toContain("45%");
    expect(v.explanation).toContain("40%");
  });

  it("proof contradicting the label ABV → mismatch", () => {
    const v = compareAlcohol(
      application(),
      labelFields({ proof: field("80 Proof") }),
    );
    expect(v.status).toBe("mismatch");
    expect(v.explanation).toMatch(/contradicts itself/i);
  });

  it("proof only, consistent with application → probable match", () => {
    const v = compareAlcohol(
      application(),
      labelFields({ alcohol_content: field(null, "high") }),
    );
    expect(v.status).toBe("probable_match");
    expect(v.explanation).toMatch(/proof matches/i);
  });

  it("proof only, inconsistent → mismatch", () => {
    const v = compareAlcohol(
      application({ abv: 40 }),
      labelFields({ alcohol_content: field(null, "high"), proof: field("90 Proof") }),
    );
    expect(v.status).toBe("mismatch");
  });

  it("missing entirely → mismatch for spirits", () => {
    const v = compareAlcohol(
      application(),
      labelFields({ alcohol_content: field(null, "high"), proof: field(null, "high") }),
    );
    expect(v.status).toBe("mismatch");
    expect(v.explanation).toMatch(/required/i);
  });

  it("unreadable → unreadable", () => {
    const v = compareAlcohol(
      application(),
      labelFields({ alcohol_content: field(null, "low"), proof: field(null, "low") }),
    );
    expect(v.status).toBe("unreadable");
  });

  it('"percent" spelled out is a compliant format → match', () => {
    const v = compareAlcohol(
      application(),
      labelFields({ alcohol_content: field("Alcohol 45 percent by volume"), proof: field(null) }),
    );
    expect(v.status).toBe("match");
  });

  it("proof on a different image than the alc/vol statement → probable match (§5.65 field of vision)", () => {
    const v = compareAlcohol(
      application(),
      labelFields({ proof: field("90 Proof", "high", 1) }),
    );
    expect(v.status).toBe("probable_match");
    expect(v.explanation).toMatch(/field of vision/i);
  });

  it("nonstandard format with matching value → probable match", () => {
    const v = compareAlcohol(
      application(),
      labelFields({ alcohol_content: field("45% ABV"), proof: field(null) }),
    );
    expect(v.status).toBe("probable_match");
    expect(v.explanation).toMatch(/format/i);
  });

  it("range on a spirits label → mismatch", () => {
    const v = compareAlcohol(
      application(),
      labelFields({ alcohol_content: field("Alc. 44% to 46% by Vol."), proof: field(null) }),
    );
    expect(v.status).toBe("mismatch");
    expect(v.explanation).toMatch(/only wine/i);
  });
});

describe("compareAlcohol — wine ranges (§4.36)", () => {
  const wine = (abv: number) =>
    application({ beverage_type: "wine", abv, class_type: "Red Table Wine" });

  it("application value inside the range → match", () => {
    const v = compareAlcohol(
      wine(12.5),
      labelFields({ alcohol_content: field("Alc. 11% to 13% by Vol."), proof: field(null) }),
    );
    expect(v.status).toBe("match");
  });

  it("application value outside the range → mismatch", () => {
    const v = compareAlcohol(
      wine(14),
      labelFields({ alcohol_content: field("Alc. 11% to 13% by Vol."), proof: field(null) }),
    );
    expect(v.status).toBe("mismatch");
    expect(v.explanation).toMatch(/outside/i);
  });

  it("range wider than 3 points at ≤14% ABV → mismatch", () => {
    const v = compareAlcohol(
      wine(12),
      labelFields({ alcohol_content: field("Alc. 10% to 14% by Vol."), proof: field(null) }),
    );
    expect(v.status).toBe("mismatch");
    expect(v.explanation).toMatch(/maximum is 3/i);
  });

  it("range wider than 2 points above 14% ABV → mismatch", () => {
    const v = compareAlcohol(
      application({ beverage_type: "wine", abv: 16, class_type: "Dessert Wine" }),
      labelFields({ alcohol_content: field("Alc. 14.5% to 17.5% by Vol."), proof: field(null) }),
    );
    expect(v.status).toBe("mismatch");
    expect(v.explanation).toMatch(/maximum is 2/i);
  });

  it("2-point range above 14% ABV containing the value → match", () => {
    const v = compareAlcohol(
      application({ beverage_type: "wine", abv: 15, class_type: "Dessert Wine" }),
      labelFields({ alcohol_content: field("Alc. 14% to 16% by Vol."), proof: field(null) }),
    );
    expect(v.status).toBe("match");
  });
});

describe("compareAlcohol — omission rules", () => {
  it("table wine ≤14% may omit alcohol content → match", () => {
    const v = compareAlcohol(
      application({ beverage_type: "wine", abv: 12, class_type: "Red Table Wine" }),
      labelFields({ alcohol_content: field(null, "high"), proof: field(null, "high") }),
    );
    expect(v.status).toBe("match");
    expect(v.explanation).toMatch(/allowed/i);
  });

  it("wine >14% must state alcohol content → mismatch when missing", () => {
    const v = compareAlcohol(
      application({ beverage_type: "wine", abv: 16, class_type: "Dessert Wine" }),
      labelFields({ alcohol_content: field(null, "high"), proof: field(null, "high") }),
    );
    expect(v.status).toBe("mismatch");
  });

  it("plain malt beverage may omit alcohol content → match", () => {
    const v = compareAlcohol(
      application({ beverage_type: "malt", abv: 5, class_type: "Lager" }),
      labelFields({ alcohol_content: field(null, "high"), proof: field(null, "high") }),
    );
    expect(v.status).toBe("match");
  });

  it("flavored malt beverage must state alcohol content → mismatch when missing", () => {
    const v = compareAlcohol(
      application({ beverage_type: "malt", abv: 8, class_type: "Flavored Malt Beverage" }),
      labelFields({ alcohol_content: field(null, "high"), proof: field(null, "high") }),
    );
    expect(v.status).toBe("mismatch");
  });
});
