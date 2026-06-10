import { describe, expect, it } from "vitest";
import { parseApplication } from "./application";

const valid = {
  application_id: "APP-001",
  beverage_type: "spirits",
  brand_name: "Old Tom Distillery",
  class_type: "Kentucky Straight Bourbon Whiskey",
  abv: 45,
  net_contents: "750 mL",
};

describe("parseApplication", () => {
  it("accepts a valid application", () => {
    const result = parseApplication(valid);
    expect(result).toEqual({ ok: true, data: valid });
  });

  it("rejects non-object input with a single message", () => {
    for (const input of [null, "text", 42, ["a"]]) {
      const result = parseApplication(input);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors).toEqual(["Application data must be a JSON object."]);
      }
    }
  });

  it("trims string fields", () => {
    const result = parseApplication({ ...valid, brand_name: "  Old Tom Distillery  " });
    expect(result.ok && result.data.brand_name).toBe("Old Tom Distillery");
  });

  it("normalizes beverage_type case and rejects unknown values", () => {
    const ok = parseApplication({ ...valid, beverage_type: " Spirits " });
    expect(ok.ok && ok.data.beverage_type).toBe("spirits");

    const bad = parseApplication({ ...valid, beverage_type: "cider" });
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.errors[0]).toContain('"beverage_type"');
      expect(bad.errors[0]).toContain("cider");
    }
  });

  it("coerces numeric-string abv, including a trailing %", () => {
    for (const abv of ["45", "45.0", "45%", " 45 "]) {
      const result = parseApplication({ ...valid, abv });
      expect(result.ok && result.data.abv, `abv=${JSON.stringify(abv)}`).toBe(45);
    }
  });

  it("rejects out-of-range or non-numeric abv", () => {
    for (const abv of [0, -1, 100, 150, "forty-five", "", NaN, null, undefined]) {
      const result = parseApplication({ ...valid, abv });
      expect(result.ok, `abv=${JSON.stringify(abv)}`).toBe(false);
      if (!result.ok) expect(result.errors[0]).toContain('"abv"');
    }
  });

  it("requires every field and reports all missing ones at once", () => {
    const result = parseApplication({});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toHaveLength(6);
      for (const field of [
        "application_id",
        "beverage_type",
        "brand_name",
        "class_type",
        "abv",
        "net_contents",
      ]) {
        expect(result.errors.join(" ")).toContain(`"${field}"`);
      }
    }
  });

  it("rejects empty and whitespace-only strings", () => {
    for (const field of ["application_id", "brand_name", "class_type", "net_contents"]) {
      const result = parseApplication({ ...valid, [field]: "   " });
      expect(result.ok, field).toBe(false);
      if (!result.ok) expect(result.errors[0]).toContain(`"${field}"`);
    }
  });
});
