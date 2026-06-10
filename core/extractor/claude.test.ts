// Recorded-response tests for the Claude extractor: a stub client returns
// canned API responses, so no live API call happens in CI. What's covered:
// the request the extractor builds (images, prompt, forced tool) and how it
// handles the responses that come back.

import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { GOVERNMENT_WARNING } from "../rules/warning";
import { createClaudeExtractor, type MessagesClient } from "./claude";
import { EXTRACTION_TOOL_NAME } from "./prompt";
import { ExtractionError, type LabelImage } from "./types";

/** Wraps a tool input in a realistic recorded API response. */
function recordedResponse(input: unknown): Anthropic.Message {
  return {
    id: "msg_recorded",
    type: "message",
    role: "assistant",
    model: "claude-opus-4-8",
    stop_reason: "tool_use",
    stop_sequence: null,
    usage: { input_tokens: 3072, output_tokens: 412 },
    content: [
      { type: "tool_use", id: "toolu_recorded", name: EXTRACTION_TOOL_NAME, input },
    ],
  } as Anthropic.Message;
}

/** Recorded extraction for the APP-001 sample (the PRD's success-criteria
 * case): every field read cleanly, warning on the back label. */
const APP_001_INPUT = {
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
    heading_all_caps: true,
    heading_bold: true,
    remainder_bold: false,
  },
};

function stubClient(response: Anthropic.Message) {
  const calls: Anthropic.MessageCreateParamsNonStreaming[] = [];
  const client: MessagesClient = {
    messages: {
      async create(params) {
        calls.push(params);
        return response;
      },
    },
  };
  return { client, calls };
}

const FRONT: LabelImage = { data: "ZnJvbnQ=", mediaType: "image/png" };
const BACK: LabelImage = { data: "YmFjaw==", mediaType: "image/jpeg" };

describe("createClaudeExtractor", () => {
  it("returns the parsed LabelFields from a recorded response", async () => {
    const { client } = stubClient(recordedResponse(APP_001_INPUT));
    const extractor = createClaudeExtractor({ client });

    const fields = await extractor.extract([FRONT, BACK], "spirits");

    expect(fields.brand_name.value).toBe("Old Tom Distillery");
    expect(fields.alcohol_content.value).toBe("Alc. 45% by Vol.");
    expect(fields.government_warning.value).toBe(GOVERNMENT_WARNING);
    expect(fields.government_warning.sourceImage).toBe(1);
    expect(fields.government_warning.headingBold).toBe(true);
    expect(fields.government_warning.remainderBold).toBe(false);
  });

  it("sends each image as a base64 block, in order, before the text", async () => {
    const { client, calls } = stubClient(recordedResponse(APP_001_INPUT));
    await createClaudeExtractor({ client }).extract([FRONT, BACK], "spirits");

    const content = calls[0].messages[0].content as Anthropic.ContentBlockParam[];
    expect(content.map((b) => b.type)).toEqual(["image", "image", "text"]);
    const [front, back] = content as Anthropic.ImageBlockParam[];
    expect(front.source).toEqual({
      type: "base64",
      media_type: "image/png",
      data: "ZnJvbnQ=",
    });
    expect(back.source).toEqual({
      type: "base64",
      media_type: "image/jpeg",
      data: "YmFjaw==",
    });
  });

  it("forces the extraction tool and includes the beverage type", async () => {
    const { client, calls } = stubClient(recordedResponse(APP_001_INPUT));
    await createClaudeExtractor({ client }).extract([FRONT], "malt");

    const params = calls[0];
    expect(params.tool_choice).toEqual({ type: "tool", name: EXTRACTION_TOOL_NAME });
    expect(params.tools?.map((t) => t.name)).toEqual([EXTRACTION_TOOL_NAME]);
    const text = (params.messages[0].content as Anthropic.TextBlockParam[]).find(
      (b) => b.type === "text",
    );
    expect(text?.text).toContain("malt beverage");
    expect(params.system).toBeTruthy();
  });

  it("uses the configured model", async () => {
    const { client, calls } = stubClient(recordedResponse(APP_001_INPUT));
    await createClaudeExtractor({ client, model: "claude-haiku-4-5" }).extract(
      [FRONT],
      "wine",
    );
    expect(calls[0].model).toBe("claude-haiku-4-5");
  });

  it("throws an actionable ExtractionError when the response has no tool call", async () => {
    const noToolUse = {
      ...recordedResponse({}),
      stop_reason: "end_turn",
      content: [{ type: "text", text: "I cannot read this image." }],
    } as Anthropic.Message;
    const { client } = stubClient(noToolUse);

    await expect(
      createClaudeExtractor({ client }).extract([FRONT], "spirits"),
    ).rejects.toThrow(ExtractionError);
  });

  it("rejects malformed tool input via the parser", async () => {
    const { client } = stubClient(
      recordedResponse({ ...APP_001_INPUT, brand_name: { value: 42 } }),
    );
    await expect(
      createClaudeExtractor({ client }).extract([FRONT], "spirits"),
    ).rejects.toThrow(ExtractionError);
  });

  it("rejects an empty or oversized image set without calling the API", async () => {
    const { client, calls } = stubClient(recordedResponse(APP_001_INPUT));
    const extractor = createClaudeExtractor({ client });

    await expect(extractor.extract([], "spirits")).rejects.toThrow(/1 or 2/);
    await expect(
      extractor.extract([FRONT, BACK, FRONT], "spirits"),
    ).rejects.toThrow(/1 or 2/);
    expect(calls).toHaveLength(0);
  });
});
