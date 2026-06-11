// Live extraction eval — the prompt-iteration loop (docs/PLAN.md §4).
// Runs the Claude extractor over the fixture images and scores it two ways:
//
//   1. Verdicts (what matters): compare(application, extracted) diffed
//      against the case's expected verdicts — the same check cases.test.ts
//      proves for the *ideal* extraction.
//   2. Fields (diagnostic): extracted values diffed against the ideal
//      extraction, so a verdict miss points at the field that caused it.
//
// Calls the live API and spends real money (~54 cases × 1–2 images each).
//
//   pnpm extract:eval                  # full batch, shipped default config
//   pnpm extract:eval APP-001 APP-031  # specific cases
//   pnpm extract:eval --extractor=claude --model=claude-haiku-4-5 --votes=3
//   pnpm extract:eval --model=gpt-5.4-nano --effort=none --resize=1100
//
// Flags: --extractor=openai|claude (default openai, the shipped default),
// --model=, --effort= (reasoning effort on OpenAI; output_config.effort on
// Claude), --votes=N (consensus), --resize=PX, --concurrency=N.

import { execFile } from "node:child_process";
import { mkdir, readFile, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
import { compare } from "../core/compare";
import { normalizeWhitespace } from "../core/compare/normalize";
import { createClaudeExtractor, DEFAULT_MODEL } from "../core/extractor";
import { createConsensusExtractor } from "../core/extractor/consensus";
import { createOpenAIExtractor, DEFAULT_OPENAI_MODEL } from "../core/extractor/openai";
import type { Extractor, LabelImage } from "../core/extractor";
import type { ExtractedField, LabelFields } from "../core/types";
import { FIXTURE_CASES, imageFiles, type FixtureCase } from "../fixtures/cases";
import { idealExtraction } from "../fixtures/extraction";

const ROOT = path.resolve(__dirname, "..");
const IMAGES_DIR = path.join(ROOT, "public", "fixtures", "images");

/** Minimal .env.local loader — tsx doesn't load it the way Next.js does. */
async function loadEnvLocal(): Promise<void> {
  try {
    const text = await readFile(path.join(ROOT, ".env.local"), "utf8");
    for (const line of text.split("\n")) {
      const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    // no .env.local — fall through to the check below
  }
}

interface FieldDiff {
  field: string;
  extracted: string | null;
  ideal: string | null;
}

interface CaseResult {
  id: string;
  note: string;
  ok: boolean;
  verdictDiffs: string[];
  fieldDiffs: FieldDiff[];
  error?: string;
  ms: number;
}

function valueOf(f: ExtractedField): string | null {
  return f.value === null ? null : normalizeWhitespace(f.value);
}

/** Diagnostic field diff vs the ideal extraction (whitespace-normalized;
 * a null is only "right" for the same reason — absent vs unreadable). */
function diffFields(extracted: LabelFields, ideal: LabelFields): FieldDiff[] {
  const diffs: FieldDiff[] = [];
  for (const field of Object.keys(ideal) as (keyof LabelFields)[]) {
    const got = extracted[field];
    const want = ideal[field];
    const sameValue = valueOf(got) === valueOf(want);
    const sameNullReason =
      want.value !== null ||
      (want.confidence === "high") === (got.confidence === "high");
    if (!sameValue || !sameNullReason) {
      diffs.push({
        field,
        extracted: got.value === null ? `null (${got.confidence})` : valueOf(got),
        ideal: want.value === null ? `null (${want.confidence})` : valueOf(want),
      });
    }
  }
  return diffs;
}

/** Downscale to `maxEdge` px (longest edge) via sips, cached in tmp —
 * simulates the production client's canvas downscale. */
async function resizedPath(file: string, maxEdge: number): Promise<string> {
  const dir = path.join(os.tmpdir(), `verify-label-resized-${maxEdge}`);
  await mkdir(dir, { recursive: true });
  const out = path.join(dir, file);
  const exists = await stat(out).then(() => true, () => false);
  if (!exists) {
    await execFileAsync("sips", ["-Z", String(maxEdge), path.join(IMAGES_DIR, file), "--out", out]);
  }
  return out;
}

async function loadImages(c: FixtureCase, maxEdge?: number): Promise<LabelImage[]> {
  return Promise.all(
    imageFiles(c).map(async (file) => {
      const source = maxEdge
        ? await resizedPath(file, maxEdge)
        : path.join(IMAGES_DIR, file);
      return {
        data: (await readFile(source)).toString("base64"),
        mediaType: "image/png" as const,
      };
    }),
  );
}

async function runCase(
  c: FixtureCase,
  extract: (images: LabelImage[], bt: FixtureCase["application"]["beverage_type"]) => Promise<LabelFields>,
  maxEdge?: number,
): Promise<CaseResult> {
  const id = c.application.application_id;
  const start = Date.now();
  try {
    const extracted = await extract(await loadImages(c, maxEdge), c.application.beverage_type);
    const result = compare(c.application, extracted);

    const verdictDiffs: string[] = [];
    for (const v of result.verdicts) {
      const want = c.expected.verdicts[v.field] ?? "match";
      if (v.status !== want) {
        verdictDiffs.push(`${v.field}: got ${v.status}, expected ${want} — ${v.explanation}`);
      }
    }
    if (result.overall !== c.expected.overall) {
      verdictDiffs.push(`overall: got ${result.overall}, expected ${c.expected.overall}`);
    }

    return {
      id,
      note: c.note,
      ok: verdictDiffs.length === 0,
      verdictDiffs,
      fieldDiffs: diffFields(extracted, idealExtraction(c)),
      ms: Date.now() - start,
    };
  } catch (error) {
    return {
      id,
      note: c.note,
      ok: false,
      verdictDiffs: [],
      fieldDiffs: [],
      error: error instanceof Error ? error.message : String(error),
      ms: Date.now() - start,
    };
  }
}

async function main(): Promise<void> {
  await loadEnvLocal();

  const args = process.argv.slice(2);
  const provider =
    args.find((a) => a.startsWith("--extractor="))?.slice("--extractor=".length) ??
    "openai";
  if (provider !== "openai" && provider !== "claude") {
    console.error(`Unknown --extractor=${provider}; use openai or claude.`);
    process.exit(1);
  }
  const keyVar = provider === "openai" ? "OPENAI_API_KEY" : "ANTHROPIC_API_KEY";
  if (!process.env[keyVar]) {
    console.error(`${keyVar} is not set (env or .env.local). The eval calls the live API.`);
    process.exit(1);
  }

  const model =
    args.find((a) => a.startsWith("--model="))?.slice("--model=".length) ??
    (provider === "openai"
      ? DEFAULT_OPENAI_MODEL
      : process.env.EXTRACTOR_MODEL ?? DEFAULT_MODEL);
  const votes = Number(
    args.find((a) => a.startsWith("--votes="))?.slice("--votes=".length) ?? 1,
  );
  const concurrency = Number(
    args.find((a) => a.startsWith("--concurrency="))?.slice("--concurrency=".length) ?? 8,
  );
  const effort = args
    .find((a) => a.startsWith("--effort="))
    ?.slice("--effort=".length) as
    | "none"
    | "minimal"
    | "low"
    | "medium"
    | "high"
    | undefined;
  const resize = args.find((a) => a.startsWith("--resize="));
  const maxEdge = resize ? Number(resize.slice("--resize=".length)) : undefined;
  const ids = args.filter((a) => !a.startsWith("--"));
  const cases = ids.length
    ? FIXTURE_CASES.filter((c) => ids.includes(c.application.application_id))
    : FIXTURE_CASES;
  const unknown = ids.filter(
    (id) => !FIXTURE_CASES.some((c) => c.application.application_id === id),
  );
  if (unknown.length) {
    console.error(`Unknown case id(s): ${unknown.join(", ")}`);
    process.exit(1);
  }

  console.log(
    `Evaluating ${cases.length} case(s) on ${model}` +
      `${votes > 1 ? ` ×${votes} consensus` : ""}` +
      `${effort ? `, effort ${effort}` : ""}` +
      `${maxEdge ? `, images ≤${maxEdge}px` : ""}` +
      `, concurrency ${concurrency}\n`,
  );
  const base: Extractor =
    provider === "openai"
      ? // Default reasoning off — the shipped default config (createDefaultExtractor).
        createOpenAIExtractor({ model, reasoningEffort: effort ?? "none" })
      : createClaudeExtractor({
          model,
          effort: effort === "minimal" || effort === "none" ? "low" : effort,
        });
  const extractor = createConsensusExtractor(base, votes);

  const results: CaseResult[] = new Array(cases.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, cases.length) }, async () => {
      while (next < cases.length) {
        const i = next++;
        results[i] = await runCase(cases[i], (imgs, bt) => extractor.extract(imgs, bt), maxEdge);
        const r = results[i];
        const mark = r.error ? "💥" : r.ok ? "✅" : "❌";
        console.log(`${mark} ${r.id} (${(r.ms / 1000).toFixed(1)}s) — ${r.note}`);
        if (r.error) console.log(`     error: ${r.error}`);
        for (const d of r.verdictDiffs) console.log(`     verdict ${d}`);
        for (const d of r.fieldDiffs) {
          console.log(`     field ${d.field}: read ${JSON.stringify(d.extracted)}, ideal ${JSON.stringify(d.ideal)}`);
        }
      }
    }),
  );

  const ok = results.filter((r) => r.ok).length;
  const errored = results.filter((r) => r.error).length;
  const fieldDiffTotal = results.reduce((n, r) => n + r.fieldDiffs.length, 0);
  const fieldsTotal = results.length * 6;
  const avgMs = results.reduce((n, r) => n + r.ms, 0) / results.length;

  console.log(`\n${"─".repeat(60)}`);
  console.log(`Verdicts correct: ${ok}/${results.length} cases${errored ? ` (${errored} errored)` : ""}`);
  console.log(
    `Fields matching ideal: ${fieldsTotal - fieldDiffTotal}/${fieldsTotal} (${(((fieldsTotal - fieldDiffTotal) / fieldsTotal) * 100).toFixed(1)}%)`,
  );
  console.log(`Avg latency: ${(avgMs / 1000).toFixed(1)}s/label (budget ≤5s)`);
  if (ok < results.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
