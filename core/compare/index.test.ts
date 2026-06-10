import { describe, expect, it } from "vitest";
import { GOVERNMENT_WARNING } from "../rules/warning";
import { compare } from "./index";
import { application, field, labelFields, warningField } from "./testHelpers";

function verdictFor(result: ReturnType<typeof compare>, fieldName: string) {
  return result.verdicts.find((v) => v.field === fieldName)!;
}

describe("compare — end to end", () => {
  it("a fully correct spirits label passes with all six verdicts", () => {
    const result = compare(application(), labelFields());
    expect(result.overall).toBe("pass");
    expect(result.verdicts).toHaveLength(6);
    expect(result.verdicts.map((v) => v.field).sort()).toEqual(
      [
        "alcohol_content",
        "brand_name",
        "class_type",
        "government_warning",
        "net_contents",
        "same_field_of_vision",
      ].sort(),
    );
    for (const v of result.verdicts) expect(v.status).toBe("match");
  });

  it("non-spirits labels get five verdicts (no field-of-vision check)", () => {
    const result = compare(
      application({
        beverage_type: "malt",
        abv: 5,
        class_type: "Lager",
        net_contents: "12 fl oz",
      }),
      labelFields({
        class_type: field("Lager"),
        alcohol_content: field("Alc. 5% by Vol."),
        proof: field(null, "high"),
        net_contents: field("12 FL. OZ."),
      }),
    );
    expect(result.verdicts).toHaveLength(5);
    expect(result.overall).toBe("pass");
  });

  it("seeded error: wrong ABV → fail", () => {
    const result = compare(
      application({ abv: 40 }),
      labelFields({ proof: field(null, "high") }),
    );
    expect(verdictFor(result, "alcohol_content").status).toBe("mismatch");
    expect(result.overall).toBe("fail");
  });

  it("seeded error: title-case warning → fail", () => {
    const result = compare(
      application(),
      labelFields({
        government_warning: warningField(
          GOVERNMENT_WARNING.replace("GOVERNMENT WARNING:", "Government Warning:"),
          { headingAllCaps: false },
        ),
      }),
    );
    expect(verdictFor(result, "government_warning").status).toBe("mismatch");
    expect(result.overall).toBe("fail");
  });

  it("seeded error: missing warning → fail", () => {
    const result = compare(
      application(),
      labelFields({ government_warning: warningField(null, { confidence: "high" }) }),
    );
    expect(verdictFor(result, "government_warning").status).toBe("mismatch");
    expect(result.overall).toBe("fail");
  });

  it("seeded error: mismatched brand → fail", () => {
    const result = compare(
      application({ brand_name: "Silver Creek" }),
      labelFields(),
    );
    expect(verdictFor(result, "brand_name").status).toBe("mismatch");
    expect(result.overall).toBe("fail");
  });

  it("seeded error: wrong net contents → fail", () => {
    const result = compare(
      application({ net_contents: "700 mL" }),
      labelFields(),
    );
    expect(verdictFor(result, "net_contents").status).toBe("mismatch");
    expect(result.overall).toBe("fail");
  });

  it("a probable match yields needs_review, not fail", () => {
    const result = compare(
      application(),
      labelFields({ brand_name: field("OLD TOM DISTILLERY") }),
    );
    expect(verdictFor(result, "brand_name").status).toBe("probable_match");
    expect(result.overall).toBe("needs_review");
  });

  it("an unreadable field yields needs_review", () => {
    const result = compare(
      application(),
      labelFields({ net_contents: field(null, "low") }),
    );
    expect(verdictFor(result, "net_contents").status).toBe("unreadable");
    expect(result.overall).toBe("needs_review");
  });

  it("a mismatch outranks probable matches (worst field wins)", () => {
    const result = compare(
      application({ net_contents: "700 mL" }),
      labelFields({ brand_name: field("OLD TOM DISTILLERY") }),
    );
    expect(result.overall).toBe("fail");
  });

  it("result carries the extraction for the UI's side-by-side view", () => {
    const fields = labelFields();
    expect(compare(application(), fields).extracted).toBe(fields);
  });
});
