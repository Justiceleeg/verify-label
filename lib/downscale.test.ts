import { describe, expect, it } from "vitest";
import { fitWithin, MAX_EDGE_PX } from "./downscale";

describe("fitWithin", () => {
  it("scales a landscape image down to the max long edge", () => {
    expect(fitWithin(3000, 2000, MAX_EDGE_PX)).toEqual({ width: 1500, height: 1000 });
  });

  it("scales a portrait image down to the max long edge", () => {
    expect(fitWithin(2000, 3000, MAX_EDGE_PX)).toEqual({ width: 1000, height: 1500 });
  });

  it("leaves already-small images untouched", () => {
    expect(fitWithin(800, 600, MAX_EDGE_PX)).toEqual({ width: 800, height: 600 });
  });

  it("leaves an exactly-max image untouched", () => {
    expect(fitWithin(1500, 900, MAX_EDGE_PX)).toEqual({ width: 1500, height: 900 });
  });

  it("rounds to whole pixels and never returns zero", () => {
    expect(fitWithin(10000, 1, MAX_EDGE_PX)).toEqual({ width: 1500, height: 1 });
  });
});
