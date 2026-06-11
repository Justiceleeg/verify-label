import { describe, expect, it, vi } from "vitest";
import { application, labelFields } from "@/core/compare/testHelpers";
import { ExtractionError, type Extractor } from "@/core/extractor";
import { createVerifyHandler, MAX_IMAGE_BYTES } from "./handler";

const PNG = "image/png";

function stubExtractor(
  impl: Extractor["extract"] = async () => labelFields(),
): Extractor {
  return { extract: impl };
}

function imageFile(name = "front.png", type = PNG, bytes = 16): File {
  return new File([new Uint8Array(bytes).fill(7)], name, { type });
}

function verifyRequest(
  opts: { application?: unknown; images?: File[]; ip?: string; votes?: string } = {},
): Request {
  // `application: undefined` means "send no application field at all".
  const app = "application" in opts ? opts.application : application();
  const { images = [imageFile()], ip, votes } = opts;
  const form = new FormData();
  if (app !== undefined) {
    form.set("application", typeof app === "string" ? app : JSON.stringify(app));
  }
  for (const image of images) form.append("images", image);
  if (votes !== undefined) form.set("votes", votes);
  return new Request("http://test/api/verify", {
    method: "POST",
    body: form,
    headers: ip ? { "x-forwarded-for": ip } : undefined,
  });
}

async function body(response: Response) {
  return (await response.json()) as { error?: string } & Record<string, unknown>;
}

describe("createVerifyHandler", () => {
  it("verifies a valid request end-to-end: 200 with verdicts and overall", async () => {
    const handler = createVerifyHandler({ extractor: stubExtractor() });
    const response = await handler(verifyRequest());
    expect(response.status).toBe(200);
    const result = await body(response);
    expect(result.overall).toBe("pass");
    expect(result.verdicts).toBeInstanceOf(Array);
    expect(result.extracted).toBeDefined();
  });

  it("passes base64 image data, media type, and beverage type to the extractor", async () => {
    const extract = vi.fn(async () => labelFields());
    const handler = createVerifyHandler({ extractor: stubExtractor(extract) });
    await handler(
      verifyRequest({
        application: application({ beverage_type: "wine" }),
        images: [imageFile("front.png", PNG, 4), imageFile("back.jpg", "image/jpeg", 4)],
      }),
    );
    expect(extract).toHaveBeenCalledOnce();
    const [images, beverageType] = extract.mock.calls[0] as unknown as [
      { data: string; mediaType: string }[],
      string,
    ];
    expect(beverageType).toBe("wine");
    expect(images).toHaveLength(2);
    expect(images[0].mediaType).toBe(PNG);
    expect(images[1].mediaType).toBe("image/jpeg");
    expect(images[0].data).toBe(Buffer.from(new Uint8Array(4).fill(7)).toString("base64"));
  });

  it("rejects a non-multipart body with 400", async () => {
    const handler = createVerifyHandler({ extractor: stubExtractor() });
    const response = await handler(
      new Request("http://test/api/verify", {
        method: "POST",
        body: "just text",
        headers: { "content-type": "text/plain" },
      }),
    );
    expect(response.status).toBe(400);
    expect((await body(response)).error).toContain("multipart/form-data");
  });

  it("rejects a missing application field with 400", async () => {
    const handler = createVerifyHandler({ extractor: stubExtractor() });
    const response = await handler(verifyRequest({ application: undefined }));
    expect(response.status).toBe(400);
    expect((await body(response)).error).toContain('"application"');
  });

  it("rejects malformed application JSON with 400", async () => {
    const handler = createVerifyHandler({ extractor: stubExtractor() });
    const response = await handler(verifyRequest({ application: "{not json" }));
    expect(response.status).toBe(400);
    expect((await body(response)).error).toContain("not valid JSON");
  });

  it("rejects invalid application data with 400 naming the bad field", async () => {
    const handler = createVerifyHandler({ extractor: stubExtractor() });
    const response = await handler(
      verifyRequest({ application: { ...application(), beverage_type: "cider" } }),
    );
    expect(response.status).toBe(400);
    expect((await body(response)).error).toContain('"beverage_type"');
  });

  it("rejects zero images with 400", async () => {
    const handler = createVerifyHandler({ extractor: stubExtractor() });
    const response = await handler(verifyRequest({ images: [] }));
    expect(response.status).toBe(400);
    expect((await body(response)).error).toContain("at least one label image");
  });

  it("rejects more than two images with 400", async () => {
    const handler = createVerifyHandler({ extractor: stubExtractor() });
    const response = await handler(
      verifyRequest({ images: [imageFile("a.png"), imageFile("b.png"), imageFile("c.png")] }),
    );
    expect(response.status).toBe(400);
    expect((await body(response)).error).toContain("At most 2");
  });

  it("rejects a disallowed image MIME type with 400", async () => {
    const handler = createVerifyHandler({ extractor: stubExtractor() });
    const response = await handler(
      verifyRequest({ images: [imageFile("label.pdf", "application/pdf")] }),
    );
    expect(response.status).toBe(400);
    expect((await body(response)).error).toContain("application/pdf");
  });

  it("rejects an empty image file with 400", async () => {
    const handler = createVerifyHandler({ extractor: stubExtractor() });
    const response = await handler(verifyRequest({ images: [imageFile("front.png", PNG, 0)] }));
    expect(response.status).toBe(400);
    expect((await body(response)).error).toContain("empty");
  });

  it("rejects an oversized image with 413 and a downscale hint", async () => {
    const handler = createVerifyHandler({ extractor: stubExtractor() });
    const response = await handler(
      verifyRequest({ images: [imageFile("huge.png", PNG, MAX_IMAGE_BYTES + 1)] }),
    );
    expect(response.status).toBe(413);
    expect((await body(response)).error).toContain("Downscale");
  });

  it("runs consensus extraction when the votes field is set", async () => {
    const extract = vi.fn(async () => labelFields());
    const handler = createVerifyHandler({ extractor: stubExtractor(extract) });
    const response = await handler(verifyRequest({ votes: "3" }));
    expect(response.status).toBe(200);
    expect(extract).toHaveBeenCalledTimes(3);
    expect((await body(response)).overall).toBe("pass");
  });

  it("rejects an invalid votes field with 400", async () => {
    const extract = vi.fn(async () => labelFields());
    const handler = createVerifyHandler({ extractor: stubExtractor(extract) });
    for (const votes of ["0", "4", "2.5", "two"]) {
      const response = await handler(verifyRequest({ votes }));
      expect(response.status).toBe(400);
      expect((await body(response)).error).toContain('"votes"');
    }
    expect(extract).not.toHaveBeenCalled();
  });

  it("rate limits per IP with 429 and Retry-After", async () => {
    const handler = createVerifyHandler({
      extractor: stubExtractor(),
      rateLimiter: { allow: (key) => key !== "1.2.3.4" },
    });
    const limited = await handler(verifyRequest({ ip: "1.2.3.4" }));
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toBe("5");

    const allowed = await handler(verifyRequest({ ip: "5.6.7.8" }));
    expect(allowed.status).toBe(200);
  });

  it("maps ExtractionError to 502 with its message", async () => {
    const handler = createVerifyHandler({
      extractor: stubExtractor(async () => {
        throw new ExtractionError("The vision model returned malformed JSON.");
      }),
    });
    const response = await handler(verifyRequest());
    expect(response.status).toBe(502);
    expect((await body(response)).error).toContain("malformed JSON");
  });

  it("maps unexpected extractor failures to 502 without leaking details", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const handler = createVerifyHandler({
      extractor: stubExtractor(async () => {
        throw new Error("ECONNRESET deep inside the SDK");
      }),
    });
    const response = await handler(verifyRequest());
    expect(response.status).toBe(502);
    const { error } = await body(response);
    expect(error).toContain("Retry the row");
    expect(error).not.toContain("ECONNRESET");
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
