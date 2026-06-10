import { describe, expect, it } from "vitest";
import { createTokenBucketLimiter } from "./rateLimit";

/** Manually-advanced clock. */
function clock(start = 0) {
  let t = start;
  return {
    now: () => t,
    advance: (ms: number) => {
      t += ms;
    },
  };
}

describe("createTokenBucketLimiter", () => {
  it("allows a burst up to capacity, then denies", () => {
    const c = clock();
    const limiter = createTokenBucketLimiter({ capacity: 3, refillPerSecond: 1, now: c.now });
    expect(limiter.allow("ip")).toBe(true);
    expect(limiter.allow("ip")).toBe(true);
    expect(limiter.allow("ip")).toBe(true);
    expect(limiter.allow("ip")).toBe(false);
  });

  it("refills over time at the configured rate", () => {
    const c = clock();
    const limiter = createTokenBucketLimiter({ capacity: 2, refillPerSecond: 1, now: c.now });
    limiter.allow("ip");
    limiter.allow("ip");
    expect(limiter.allow("ip")).toBe(false);

    c.advance(999);
    expect(limiter.allow("ip")).toBe(false);
    c.advance(1);
    expect(limiter.allow("ip")).toBe(true);
    expect(limiter.allow("ip")).toBe(false);
  });

  it("never refills past capacity", () => {
    const c = clock();
    const limiter = createTokenBucketLimiter({ capacity: 2, refillPerSecond: 1, now: c.now });
    c.advance(60_000);
    expect(limiter.allow("ip")).toBe(true);
    expect(limiter.allow("ip")).toBe(true);
    expect(limiter.allow("ip")).toBe(false);
  });

  it("tracks keys independently", () => {
    const c = clock();
    const limiter = createTokenBucketLimiter({ capacity: 1, refillPerSecond: 1, now: c.now });
    expect(limiter.allow("a")).toBe(true);
    expect(limiter.allow("a")).toBe(false);
    expect(limiter.allow("b")).toBe(true);
  });

  it("sustains the steady-state batch rate (concurrency 8, ~4s per call)", () => {
    const c = clock();
    const limiter = createTokenBucketLimiter({ now: c.now }); // defaults
    // 100 labels: 8 fired every 4 seconds — 2 req/s sustained.
    let denied = 0;
    for (let wave = 0; wave < 13; wave++) {
      for (let i = 0; i < 8; i++) {
        if (!limiter.allow("agent")) denied++;
      }
      c.advance(4_000);
    }
    expect(denied).toBe(0);
  });
});
