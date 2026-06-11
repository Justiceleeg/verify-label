import { describe, expect, it, vi } from "vitest";
import type { ApplicationData, VerificationResult } from "@/core/types";
import { verifyLabel } from "./verifyLabel";

const app: ApplicationData = {
  application_id: "APP-001",
  beverage_type: "spirits",
  brand_name: "Old Tom Distillery",
  class_type: "Kentucky Straight Bourbon Whiskey",
  abv: 45,
  net_contents: "750 mL",
};

const sampleResult = { extracted: {}, verdicts: [], overall: "pass" } as unknown as VerificationResult;

function jsonResponse(status: number, body: unknown, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

/** Stub fetch returning (or throwing) each entry in order; records bodies. */
function fetchSequence(...outcomes: (Response | Error)[]) {
  const bodies: FormData[] = [];
  const impl = vi.fn(async (_url: unknown, init?: RequestInit) => {
    bodies.push(init?.body as FormData);
    const next = outcomes.shift();
    if (!next) throw new Error("fetch called more times than expected");
    if (next instanceof Error) throw next;
    return next;
  });
  return { impl: impl as unknown as typeof fetch, bodies, calls: impl };
}

const image = () => new Blob(["fake-jpeg-bytes"], { type: "image/jpeg" });

describe("verifyLabel", () => {
  it("returns the parsed result on 200 and sends the right form fields", async () => {
    const { impl, bodies, calls } = fetchSequence(jsonResponse(200, sampleResult));
    const outcome = await verifyLabel(app, [image(), image()], { fetchImpl: impl });

    expect(outcome).toEqual({ ok: true, result: sampleResult });
    expect(calls).toHaveBeenCalledTimes(1);
    expect(calls).toHaveBeenCalledWith("/api/verify", expect.objectContaining({ method: "POST" }));
    const form = bodies[0];
    expect(JSON.parse(form.get("application") as string)).toEqual(app);
    expect(form.getAll("images")).toHaveLength(2);
    expect(form.get("votes")).toBeNull();
  });

  it("sends the votes field when consensus is requested", async () => {
    const { impl, bodies } = fetchSequence(jsonResponse(200, sampleResult));
    await verifyLabel(app, [image()], { fetchImpl: impl, votes: 3 });
    expect(bodies[0].get("votes")).toBe("3");
  });

  it("maps 400 to a non-retryable validation failure with the server message", async () => {
    const { impl, calls } = fetchSequence(
      jsonResponse(400, { error: 'Invalid application data: "abv" must be a number.' }),
    );
    const outcome = await verifyLabel(app, [image()], { fetchImpl: impl });

    expect(outcome).toEqual({
      ok: false,
      kind: "validation",
      message: 'Invalid application data: "abv" must be a number.',
      retryable: false,
    });
    expect(calls).toHaveBeenCalledTimes(1);
  });

  it("maps 413 to a non-retryable too_large failure", async () => {
    const { impl, calls } = fetchSequence(
      jsonResponse(413, { error: "Image is 5.0MB — the limit is 4MB per image." }),
    );
    const outcome = await verifyLabel(app, [image()], { fetchImpl: impl });

    expect(outcome).toMatchObject({ ok: false, kind: "too_large", retryable: false });
    expect(calls).toHaveBeenCalledTimes(1);
  });

  it("retries once after Retry-After on 429, then succeeds", async () => {
    const { impl, calls } = fetchSequence(
      jsonResponse(429, { error: "Too many requests." }, { "Retry-After": "2" }),
      jsonResponse(200, sampleResult),
    );
    const delay = vi.fn(async () => {});
    const outcome = await verifyLabel(app, [image()], { fetchImpl: impl, delay });

    expect(outcome).toEqual({ ok: true, result: sampleResult });
    expect(calls).toHaveBeenCalledTimes(2);
    expect(delay).toHaveBeenCalledWith(2000);
  });

  it("defaults the rate-limit wait to 5s when Retry-After is missing", async () => {
    const { impl } = fetchSequence(
      jsonResponse(429, { error: "Too many requests." }),
      jsonResponse(200, sampleResult),
    );
    const delay = vi.fn(async () => {});
    await verifyLabel(app, [image()], { fetchImpl: impl, delay });

    expect(delay).toHaveBeenCalledWith(5000);
  });

  it("retries 502 exactly once, then surfaces the failure as retryable", async () => {
    const { impl, calls } = fetchSequence(
      jsonResponse(502, { error: "Label extraction failed: upstream timeout." }),
      jsonResponse(502, { error: "Label extraction failed: upstream timeout." }),
    );
    const outcome = await verifyLabel(app, [image()], { fetchImpl: impl });

    expect(outcome).toEqual({
      ok: false,
      kind: "extraction",
      message: "Label extraction failed: upstream timeout.",
      retryable: true,
    });
    expect(calls).toHaveBeenCalledTimes(2);
  });

  it("retries a thrown network error once, then succeeds", async () => {
    const { impl, calls } = fetchSequence(
      new TypeError("fetch failed"),
      jsonResponse(200, sampleResult),
    );
    const outcome = await verifyLabel(app, [image()], { fetchImpl: impl });

    expect(outcome).toEqual({ ok: true, result: sampleResult });
    expect(calls).toHaveBeenCalledTimes(2);
  });

  it("falls back to a canned message when the error body isn't JSON", async () => {
    const { impl } = fetchSequence(
      new Response("Bad Gateway", { status: 502 }),
      new Response("Bad Gateway", { status: 502 }),
    );
    const outcome = await verifyLabel(app, [image()], { fetchImpl: impl });

    expect(outcome).toMatchObject({
      ok: false,
      kind: "extraction",
      retryable: true,
      message: expect.stringMatching(/try again/i),
    });
  });
});
