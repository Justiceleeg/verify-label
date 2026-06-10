import { describe, expect, it } from "vitest";
import { compareFieldOfVision } from "./fieldOfVision";
import { application, field, labelFields } from "./testHelpers";

describe("compareFieldOfVision", () => {
  it("does not apply to wine or malt", () => {
    expect(
      compareFieldOfVision(application({ beverage_type: "wine" }), labelFields()),
    ).toBeNull();
    expect(
      compareFieldOfVision(application({ beverage_type: "malt" }), labelFields()),
    ).toBeNull();
  });

  it("all three fields on the same image → match", () => {
    const v = compareFieldOfVision(application(), labelFields());
    expect(v?.status).toBe("match");
    expect(v?.field).toBe("same_field_of_vision");
  });

  it("alcohol content on a different image → probable match, flagged", () => {
    const v = compareFieldOfVision(
      application(),
      labelFields({ alcohol_content: field("Alc. 45% by Vol.", "high", 1) }),
    );
    expect(v?.status).toBe("probable_match");
    expect(v?.explanation).toMatch(/different images/i);
  });

  it("falls back to the proof statement when no alc/vol statement", () => {
    const v = compareFieldOfVision(
      application(),
      labelFields({ alcohol_content: field(null, "high") }),
    );
    expect(v?.status).toBe("match");
  });

  it("a missing member → unreadable", () => {
    const v = compareFieldOfVision(
      application(),
      labelFields({ class_type: field(null, "low") }),
    );
    expect(v?.status).toBe("unreadable");
    expect(v?.explanation).toMatch(/class\/type/);
  });
});
