import { describe, expect, it, vi } from "vitest";
import type { ApplicationData, VerificationResult } from "@/core/types";
import type { VerifyOptions, VerifyOutcome } from "@/lib/verifyLabel";
import type { ImageSource } from "./imageSource";
import type { BatchRowInput } from "./preflight";
import { runBatch, type RowState } from "./run";

const passResult = { extracted: {}, verdicts: [], overall: "pass" } as unknown as VerificationResult;
const okOutcome: VerifyOutcome = { ok: true, result: passResult };

function makeRows(count: number): BatchRowInput[] {
  return Array.from({ length: count }, (_, i) => ({
    line: i + 2,
    application: {
      application_id: `APP-${i + 1}`,
      beverage_type: "spirits",
      brand_name: "Old Tom",
      class_type: "Bourbon",
      abv: 45,
      net_contents: "750 mL",
    } satisfies ApplicationData,
    imageNames: [`app-${i + 1}.png`],
  }));
}

function makeImages(rows: BatchRowInput[]): Map<string, ImageSource> {
  const images = new Map<string, ImageSource>();
  for (const row of rows) {
    for (const name of row.imageNames) {
      images.set(name, {
        name,
        getFile: async () => new File(["bytes"], name, { type: "image/png" }),
      });
    }
  }
  return images;
}

/** Records every state transition per line, in order. */
function stateRecorder() {
  const states = new Map<number, RowState[]>();
  const onState = (line: number, state: RowState) => {
    states.set(line, [...(states.get(line) ?? []), state]);
  };
  return { states, onState };
}

describe("runBatch", () => {
  it("runs every row to done and reports running → done per row", async () => {
    const rows = makeRows(3);
    const { states, onState } = stateRecorder();
    const verify = vi.fn(async () => okOutcome);

    await runBatch(rows, makeImages(rows), { onState, verify });

    expect(verify).toHaveBeenCalledTimes(3);
    for (const row of rows) {
      expect(states.get(row.line)).toEqual([
        { status: "running", retrying: false },
        { status: "done", result: passResult },
      ]);
    }
  });

  it("passes the row's files to verify in CSV order", async () => {
    const rows: BatchRowInput[] = [
      { ...makeRows(1)[0], imageNames: ["front.png", "back.png"] },
    ];
    const images = makeImages(rows);
    const verify = vi.fn<(app: ApplicationData, files: File[]) => Promise<VerifyOutcome>>(
      async () => okOutcome,
    );

    await runBatch(rows, images, { onState: () => {}, verify });

    expect(verify.mock.calls[0][1].map((f) => f.name)).toEqual([
      "front.png",
      "back.png",
    ]);
  });

  it("never exceeds the concurrency bound", async () => {
    const rows = makeRows(20);
    let inFlight = 0;
    let peak = 0;
    const verify = vi.fn(async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 1));
      inFlight -= 1;
      return okOutcome;
    });

    await runBatch(rows, makeImages(rows), { onState: () => {}, verify, concurrency: 4 });

    expect(verify).toHaveBeenCalledTimes(20);
    expect(peak).toBeLessThanOrEqual(4);
  });

  it("isolates failures: a failed row becomes error while others finish", async () => {
    const rows = makeRows(3);
    const { states, onState } = stateRecorder();
    const verify = vi.fn(async (app: ApplicationData) =>
      app.application_id === "APP-2"
        ? ({
            ok: false,
            kind: "extraction",
            message: "upstream failure",
            retryable: true,
          } satisfies VerifyOutcome)
        : okOutcome,
    );

    await runBatch(rows, makeImages(rows), { onState, verify });

    expect(states.get(3)?.at(-1)).toEqual({
      status: "error",
      kind: "extraction",
      message: "upstream failure",
      retryable: true,
    });
    expect(states.get(2)?.at(-1)).toEqual({ status: "done", result: passResult });
    expect(states.get(4)?.at(-1)).toEqual({ status: "done", result: passResult });
  });

  it("turns a missing/unreadable image into a non-retryable row error", async () => {
    const rows = makeRows(1);
    const { states, onState } = stateRecorder();

    await runBatch(rows, new Map(), { onState, verify: vi.fn() });

    expect(states.get(2)?.at(-1)).toMatchObject({
      status: "error",
      kind: "validation",
      message: expect.stringContaining("no longer available"),
      retryable: false,
    });
  });

  it("relays verifyLabel's retry notice as a retrying running state", async () => {
    const rows = makeRows(1);
    const { states, onState } = stateRecorder();
    const verify = vi.fn(async (_app, _files, opts: VerifyOptions) => {
      opts.onRetry?.({
        ok: false,
        kind: "rate_limited",
        message: "busy",
        retryable: true,
      });
      return okOutcome;
    });

    await runBatch(rows, makeImages(rows), { onState, verify });

    expect(states.get(2)).toEqual([
      { status: "running", retrying: false },
      { status: "running", retrying: true },
      { status: "done", result: passResult },
    ]);
  });

  it("on abort, resets in-flight rows to pending and starts no new ones", async () => {
    const rows = makeRows(6);
    const { states, onState } = stateRecorder();
    const controller = new AbortController();
    let started = 0;
    const verify = vi.fn(async (_app, _files, opts: VerifyOptions) => {
      started += 1;
      if (started === 2) controller.abort();
      if (opts.signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      return okOutcome;
    });

    await runBatch(rows, makeImages(rows), {
      onState,
      verify,
      concurrency: 2,
      signal: controller.signal,
    });

    // Worker 1's row settled before the abort; worker 2's row was reset.
    const finals = [...states.values()].map((s) => s.at(-1)!.status);
    expect(finals.filter((s) => s === "done")).toHaveLength(1);
    expect(finals.filter((s) => s === "pending")).toHaveLength(1);
    // The other four rows were never started.
    expect(states.size).toBe(2);
  });
});
