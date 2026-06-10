// Public surface of the extraction layer. The API route consumes Extractor;
// which implementation backs it is config (docs/ARCHITECTURE.md "Extractor
// implementations and production paths").

import { createClaudeExtractor } from "./claude";
import { createOpenAIExtractor } from "./openai";
import type { Extractor } from "./types";

/**
 * The shipped default: gpt-5.4-mini with reasoning off — chosen on the
 * fixture benchmark (docs/ARCHITECTURE.md "Extractor benchmark"): 3.9s/label
 * (only config under the ≤5s budget), ~$0.01/label, no hallucinated
 * readings, misses confined to absent-vs-unreadable classification (both
 * directions land in human review).
 *
 * Env overrides: EXTRACTOR_PROVIDER=claude switches implementation;
 * EXTRACTOR_MODEL overrides the model within the chosen provider.
 */
export function createDefaultExtractor(): Extractor {
  if (process.env.EXTRACTOR_PROVIDER === "claude") {
    return createClaudeExtractor();
  }
  return createOpenAIExtractor({
    model: process.env.EXTRACTOR_MODEL,
    reasoningEffort: "none",
  });
}

export { createClaudeExtractor, DEFAULT_MODEL } from "./claude";
export type { ClaudeExtractorOptions, MessagesClient } from "./claude";
export { createConsensusExtractor } from "./consensus";
export { createOpenAIExtractor, DEFAULT_OPENAI_MODEL } from "./openai";
export type { ChatClient, OpenAIExtractorOptions } from "./openai";
export { ExtractionError } from "./types";
export type { Extractor, LabelImage } from "./types";
