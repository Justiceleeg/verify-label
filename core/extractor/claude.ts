// Claude vision extractor — the alternative Extractor implementation
// (the shipped default is openai.ts; see docs/ARCHITECTURE.md "Extractor
// benchmark"). One vision call per label, forced tool use, schema-validated
// output; no thinking, no multi-pass — the ≤5s latency budget rules both out.

import Anthropic from "@anthropic-ai/sdk";
import type { BeverageType, LabelFields } from "../types";
import { parseLabelFields } from "./parse";
import { EXTRACTION_TOOL, EXTRACTION_TOOL_NAME, SYSTEM_PROMPT, userText } from "./prompt";
import { ExtractionError, type Extractor, type LabelImage } from "./types";

export const DEFAULT_MODEL = "claude-opus-4-8";

/** The slice of the Anthropic client the extractor uses — the seam recorded-
 * response tests stub (no live API in CI). */
export interface MessagesClient {
  messages: {
    create(
      params: Anthropic.MessageCreateParamsNonStreaming,
    ): Promise<Anthropic.Message>;
  };
}

export interface ClaudeExtractorOptions {
  /** Defaults to a real Anthropic client (ANTHROPIC_API_KEY from the env). */
  client?: MessagesClient;
  /** Defaults to EXTRACTOR_MODEL from the env, then claude-opus-4-8. */
  model?: string;
  /**
   * Thinking depth / token-spend control. Extraction is transcription, not
   * reasoning — "low" cuts latency on models whose default is "high"
   * (Sonnet 4.6). Omit for models that don't support it (Haiku 4.5).
   */
  effort?: "low" | "medium" | "high";
}

export function createClaudeExtractor(
  options: ClaudeExtractorOptions = {},
): Extractor {
  const client = options.client ?? new Anthropic();
  const model = options.model ?? process.env.EXTRACTOR_MODEL ?? DEFAULT_MODEL;
  const effort = options.effort;

  return {
    async extract(
      images: LabelImage[],
      beverageType: BeverageType,
    ): Promise<LabelFields> {
      if (images.length < 1 || images.length > 2) {
        throw new ExtractionError(
          `Expected 1 or 2 label images, got ${images.length}.`,
        );
      }

      const response = await client.messages.create({
        model,
        max_tokens: 2048,
        ...(effort ? { output_config: { effort } } : {}),
        system: SYSTEM_PROMPT,
        tools: [EXTRACTION_TOOL],
        tool_choice: { type: "tool", name: EXTRACTION_TOOL_NAME },
        messages: [
          {
            role: "user",
            content: [
              ...images.map(
                (image): Anthropic.ImageBlockParam => ({
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: image.mediaType,
                    data: image.data,
                  },
                }),
              ),
              { type: "text", text: userText(beverageType) },
            ],
          },
        ],
      });

      const toolUse = response.content.find(
        (block): block is Anthropic.ToolUseBlock =>
          block.type === "tool_use" && block.name === EXTRACTION_TOOL_NAME,
      );
      if (!toolUse) {
        throw new ExtractionError(
          `The vision model returned no ${EXTRACTION_TOOL_NAME} call (stop_reason: ${response.stop_reason}). Retry the row; if it persists, the image may not be a label photo.`,
        );
      }
      return parseLabelFields(toolUse.input);
    },
  };
}
