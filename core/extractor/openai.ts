// OpenAI vision extractor — the shipped default implementation, chosen on
// the fixture benchmark (docs/ARCHITECTURE.md "Extractor benchmark"):
// gpt-5.4-mini with reasoning off was the only config under the ≤5s budget,
// with no hallucinated readings. Reuses the exact extraction prompt and
// schema from prompt.ts: the model differs, the contract doesn't.

import OpenAI from "openai";
import type { BeverageType, LabelFields } from "../types";
import { parseLabelFields } from "./parse";
import { EXTRACTION_TOOL, EXTRACTION_TOOL_NAME, SYSTEM_PROMPT, userText } from "./prompt";
import { ExtractionError, type Extractor, type LabelImage } from "./types";

export const DEFAULT_OPENAI_MODEL = "gpt-5.4-mini";

/** The slice of the OpenAI client the extractor uses (stubbed in tests). */
export interface ChatClient {
  chat: {
    completions: {
      create(
        params: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming,
      ): Promise<OpenAI.Chat.ChatCompletion>;
    };
  };
}

export interface OpenAIExtractorOptions {
  /** Defaults to a real OpenAI client (OPENAI_API_KEY from the env). */
  client?: ChatClient;
  model?: string;
  /** Reasoning depth for gpt-5-family models — "none" (gpt-5.4+) or
   * "minimal" (older gpt-5) is the latency setting for transcription work.
   * Omit for models without the knob. */
  reasoningEffort?: "none" | "minimal" | "low" | "medium" | "high";
}

export function createOpenAIExtractor(
  options: OpenAIExtractorOptions = {},
): Extractor {
  const client = options.client ?? new OpenAI();
  const model = options.model ?? DEFAULT_OPENAI_MODEL;
  const reasoningEffort = options.reasoningEffort;

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

      const completion = await client.chat.completions.create({
        model,
        ...(reasoningEffort
          ? { reasoning_effort: reasoningEffort as OpenAI.ReasoningEffort }
          : {}),
        response_format: {
          type: "json_schema",
          json_schema: {
            name: EXTRACTION_TOOL_NAME,
            strict: true,
            schema: EXTRACTION_TOOL.input_schema as unknown as Record<string, unknown>,
          },
        },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              ...images.map(
                (image): OpenAI.Chat.ChatCompletionContentPartImage => ({
                  type: "image_url",
                  image_url: {
                    url: `data:${image.mediaType};base64,${image.data}`,
                    detail: "high",
                  },
                }),
              ),
              { type: "text", text: userText(beverageType) },
            ],
          },
        ],
      });

      const message = completion.choices[0]?.message;
      if (message?.refusal) {
        throw new ExtractionError(
          `The vision model refused the request: ${message.refusal}`,
        );
      }
      if (!message?.content) {
        throw new ExtractionError(
          `The vision model returned no content (finish_reason: ${completion.choices[0]?.finish_reason}). Retry the row.`,
        );
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(message.content);
      } catch (cause) {
        throw new ExtractionError("The vision model returned malformed JSON.", { cause });
      }
      return parseLabelFields(parsed);
    },
  };
}
