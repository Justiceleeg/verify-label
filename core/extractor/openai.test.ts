// Recorded-response tests for the OpenAI extractor (the shipped default) —
// stubbed client, no live API in CI. Mirrors claude.test.ts: the request the
// extractor builds, and how it handles what comes back.

import type OpenAI from "openai";
import { describe, expect, it } from "vitest";
import { GOVERNMENT_WARNING } from "../rules/warning";
import { createOpenAIExtractor, type ChatClient } from "./openai";
import { EXTRACTION_TOOL_NAME } from "./prompt";
import { ExtractionError, type LabelImage } from "./types";

const APP_001_JSON = JSON.stringify({
  legibility_notes: "Every part of both images is legible.",
  brand_name: { value: "Old Tom Distillery", confidence: "high", source_image: 0 },
  class_type: {
    value: "Kentucky Straight Bourbon Whiskey",
    confidence: "high",
    source_image: 0,
  },
  alcohol_content: { value: "Alc. 45% by Vol.", confidence: "high", source_image: 0 },
  proof: { value: "90 Proof", confidence: "high", source_image: 0 },
  net_contents: { value: "750 mL", confidence: "high", source_image: 0 },
  government_warning: {
    value: GOVERNMENT_WARNING,
    confidence: "high",
    source_image: 1,
    heading_bold: true,
    remainder_bold: false,
  },
});

function recordedCompletion(
  content: string | null,
  refusal: string | null = null,
): OpenAI.Chat.ChatCompletion {
  return {
    id: "chatcmpl_recorded",
    object: "chat.completion",
    created: 0,
    model: "gpt-5.4-mini",
    choices: [
      {
        index: 0,
        message: { role: "assistant", content, refusal },
        finish_reason: "stop",
        logprobs: null,
      },
    ],
  } as OpenAI.Chat.ChatCompletion;
}

function stubClient(response: OpenAI.Chat.ChatCompletion) {
  const calls: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming[] = [];
  const client: ChatClient = {
    chat: {
      completions: {
        async create(params) {
          calls.push(params);
          return response;
        },
      },
    },
  };
  return { client, calls };
}

const FRONT: LabelImage = { data: "ZnJvbnQ=", mediaType: "image/png" };
const BACK: LabelImage = { data: "YmFjaw==", mediaType: "image/jpeg" };

describe("createOpenAIExtractor", () => {
  it("returns the parsed LabelFields from a recorded response", async () => {
    const { client } = stubClient(recordedCompletion(APP_001_JSON));
    const fields = await createOpenAIExtractor({ client }).extract(
      [FRONT, BACK],
      "spirits",
    );
    expect(fields.brand_name.value).toBe("Old Tom Distillery");
    expect(fields.government_warning.value).toBe(GOVERNMENT_WARNING);
    expect(fields.government_warning.headingBold).toBe(true);
  });

  it("sends images as data URLs in order, with high detail, before the text", async () => {
    const { client, calls } = stubClient(recordedCompletion(APP_001_JSON));
    await createOpenAIExtractor({ client }).extract([FRONT, BACK], "wine");

    const user = calls[0].messages.find((m) => m.role === "user");
    const parts = user?.content as OpenAI.Chat.ChatCompletionContentPart[];
    expect(parts.map((p) => p.type)).toEqual(["image_url", "image_url", "text"]);
    const [front, back] = parts as OpenAI.Chat.ChatCompletionContentPartImage[];
    expect(front.image_url).toEqual({
      url: "data:image/png;base64,ZnJvbnQ=",
      detail: "high",
    });
    expect(back.image_url.url).toBe("data:image/jpeg;base64,YmFjaw==");
  });

  it("enforces the strict JSON schema and passes reasoning effort", async () => {
    const { client, calls } = stubClient(recordedCompletion(APP_001_JSON));
    await createOpenAIExtractor({ client, reasoningEffort: "none" }).extract(
      [FRONT],
      "malt",
    );
    const params = calls[0];
    expect(params.reasoning_effort).toBe("none");
    expect(params.response_format).toMatchObject({
      type: "json_schema",
      json_schema: { name: EXTRACTION_TOOL_NAME, strict: true },
    });
    expect(params.messages[0]).toMatchObject({ role: "system" });
  });

  it("throws ExtractionError on a refusal", async () => {
    const { client } = stubClient(recordedCompletion(null, "I can't help with that."));
    await expect(
      createOpenAIExtractor({ client }).extract([FRONT], "spirits"),
    ).rejects.toThrow(/refused/);
  });

  it("throws ExtractionError on empty or malformed content", async () => {
    const empty = stubClient(recordedCompletion(null));
    await expect(
      createOpenAIExtractor({ client: empty.client }).extract([FRONT], "spirits"),
    ).rejects.toThrow(ExtractionError);

    const malformed = stubClient(recordedCompletion("{not json"));
    await expect(
      createOpenAIExtractor({ client: malformed.client }).extract([FRONT], "spirits"),
    ).rejects.toThrow(/malformed JSON/);
  });

  it("rejects an empty or oversized image set without calling the API", async () => {
    const { client, calls } = stubClient(recordedCompletion(APP_001_JSON));
    const extractor = createOpenAIExtractor({ client });
    await expect(extractor.extract([], "spirits")).rejects.toThrow(/1 or 2/);
    await expect(extractor.extract([FRONT, BACK, FRONT], "spirits")).rejects.toThrow(/1 or 2/);
    expect(calls).toHaveLength(0);
  });
});
