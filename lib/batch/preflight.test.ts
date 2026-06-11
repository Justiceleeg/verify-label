import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { preflight } from "./preflight";

const FIXTURES = path.resolve(__dirname, "../../fixtures");
const fixtureImages = readdirSync(
  path.resolve(__dirname, "../../public/fixtures/images"),
);
const read = (...parts: string[]) =>
  readFileSync(path.join(FIXTURES, ...parts), "utf8");

const HEADER =
  "application_id,beverage_type,brand_name,class_type,abv,net_contents,image_files";
const VALID_ROW =
  "APP-001,spirits,Old Tom Distillery,Kentucky Straight Bourbon Whiskey,45,750 mL,front.png";

describe("preflight", () => {
  it("accepts the shipped sample batch with no problems or orphans", () => {
    const result = preflight(read("applications.csv"), fixtureImages);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows).toHaveLength(55);
    expect(result.problems).toEqual([]);
    expect(result.orphanImages).toEqual([]);
    expect(result.rows[0]).toEqual({
      line: 2,
      application: {
        application_id: "APP-001",
        beverage_type: "spirits",
        brand_name: "Old Tom Distillery",
        class_type: "Kentucky Straight Bourbon Whiskey",
        abv: 45,
        net_contents: "750 mL",
      },
      imageNames: ["app-001-front.png", "app-001-back.png"],
    });
  });

  it("rejects the missing-column fixture naming the absent column", () => {
    const result = preflight(read("preflight", "missing-column.csv"), fixtureImages);

    expect(result).toMatchObject({
      ok: false,
      fileError: expect.stringContaining("net_contents"),
    });
  });

  it("flags rows with missing image references and rows with no images", () => {
    const result = preflight(read("preflight", "missing-image.csv"), fixtureImages);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // APP-001 is intact; APP-901 references an absent image; APP-902 lists none.
    expect(result.rows.map((r) => r.application.application_id)).toEqual(["APP-001"]);
    expect(result.problems).toEqual([
      {
        line: 3,
        applicationId: "APP-901",
        messages: [expect.stringContaining('"phantom-ridge-front.png" wasn\'t provided')],
      },
      {
        line: 4,
        applicationId: "APP-902",
        messages: [expect.stringContaining("at least one image")],
      },
    ]);
  });

  it("collects field errors and image errors on the same row", () => {
    const result = preflight(
      `${HEADER}\nAPP-001,spirits,Old Tom,Bourbon,not-a-number,750 mL,nope.png`,
      ["front.png"],
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows).toEqual([]);
    expect(result.problems).toEqual([
      {
        line: 2,
        applicationId: "APP-001",
        messages: [
          expect.stringContaining('"abv"'),
          expect.stringContaining('"nope.png"'),
        ],
      },
    ]);
    expect(result.orphanImages).toEqual(["front.png"]);
  });

  it("hints when an image reference differs only by case", () => {
    const result = preflight(
      `${HEADER}\nAPP-001,spirits,Old Tom,Bourbon,45,750 mL,Front.PNG`,
      ["front.png"],
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.problems[0].messages[0]).toContain('did you mean "front.png"');
  });

  it("rejects rows listing more than two images", () => {
    const result = preflight(
      `${HEADER}\nAPP-001,spirits,Old Tom,Bourbon,45,750 mL,a.png;b.png;c.png`,
      ["a.png", "b.png", "c.png"],
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.problems[0].messages).toEqual([
      expect.stringContaining("the limit is 2"),
    ]);
  });

  it("rejects a header-only CSV", () => {
    const result = preflight(`${HEADER}\n`, []);

    expect(result).toMatchObject({
      ok: false,
      fileError: expect.stringContaining("no application rows"),
    });
  });

  it("tolerates padded headers and blank lines", () => {
    const padded = HEADER.split(",")
      .map((h) => ` ${h} `)
      .join(",");
    const result = preflight(`${padded}\n${VALID_ROW}\n\n`, ["front.png"]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows).toHaveLength(1);
    expect(result.problems).toEqual([]);
  });
});
