"use client";

// Single-label checker container: phase state machine (form → checking →
// results), client-side validation via core's parseApplication, and the call
// into lib/verifyLabel. Form values and files survive every transition, so
// errors and "edit and re-check" never lose the agent's input.

import { ShuffleIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { parseApplication } from "@/core/application";
import type { VerificationResult } from "@/core/types";
import { fetchDemoImages, randomSingleExample, type DemoCase } from "@/lib/demo";
import { verifyLabelFiles, type VerifyFailureKind } from "@/lib/verifyLabel";
import { ApplicationForm, EMPTY_FORM, type FormValues } from "./ApplicationForm";
import { OUTCOME_BADGE } from "./batch/OverallBadge";
import { ResultsView } from "./ResultsView";

type Phase =
  | { name: "form"; error?: { kind: VerifyFailureKind; message: string } }
  | { name: "checking"; retrying: boolean }
  | { name: "results"; result: VerificationResult };

// Friendly inline messages for empty required fields; parseApplication's own
// message is kept for filled-but-invalid values (e.g. an out-of-range ABV).
const REQUIRED_MESSAGES: Record<string, string> = {
  application_id: "Enter the application ID.",
  brand_name: "Enter the brand name.",
  class_type: "Enter the class/type.",
  abv: "Enter the alcohol content, e.g. 45.",
  net_contents: "Enter the net contents, e.g. 750 mL.",
};

const RECOVERY_HINTS: Partial<Record<VerifyFailureKind, string>> = {
  rate_limited: "Wait a few seconds and press Check label again.",
  extraction: "If it keeps failing, try a clearer photo.",
};

function ErrorBanner({ kind, message }: { kind: VerifyFailureKind; message: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  const hint = RECOVERY_HINTS[kind];
  return (
    <Alert
      ref={ref}
      tabIndex={-1}
      variant="destructive"
      className="border-destructive/30 bg-destructive/5 outline-none"
    >
      <AlertTitle>Couldn&apos;t check this label</AlertTitle>
      <AlertDescription>
        {message}
        {hint ? ` ${hint}` : ""}
      </AlertDescription>
    </Alert>
  );
}

/** The story behind a loaded example, so the presenter knows what's coming. */
function ExampleNote({ example, onDismiss }: { example: DemoCase; onDismiss: () => void }) {
  const badge = OUTCOME_BADGE[example.overall];
  const BadgeIcon = badge.icon;
  return (
    <Alert>
      <AlertTitle className="flex flex-wrap items-center gap-x-2 gap-y-1 pr-8">
        {`Example loaded: ${example.application.application_id}`}
        <Badge variant="outline" className={`gap-1 ${badge.classes}`}>
          <BadgeIcon aria-hidden="true" />
          {`Expect: ${badge.text}`}
        </Badge>
      </AlertTitle>
      <AlertDescription>
        {`${example.note} Everything below is editable — tweak a field to see the verdict change.`}
      </AlertDescription>
      <AlertAction>
        <Button type="button" variant="ghost" size="icon-xs" onClick={onDismiss}>
          <XIcon aria-hidden="true" />
          <span className="sr-only">Dismiss</span>
        </Button>
      </AlertAction>
    </Alert>
  );
}

export function SingleLabelChecker() {
  const [values, setValues] = useState<FormValues>(EMPTY_FORM);
  const [files, setFiles] = useState<{ front: File | null; back: File | null }>({
    front: null,
    back: null,
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [phase, setPhase] = useState<Phase>({ name: "form" });
  const [example, setExample] = useState<DemoCase | null>(null);
  const [exampleBusy, setExampleBusy] = useState(false);
  const [exampleError, setExampleError] = useState<string | null>(null);

  async function loadExample() {
    setExampleBusy(true);
    setExampleError(null);
    try {
      // Different from the currently loaded one, so the button always shows
      // something new.
      const demo = randomSingleExample(example?.application.application_id);
      const [front, back] = await fetchDemoImages(demo.image_files);
      setValues({
        application_id: demo.application.application_id,
        beverage_type: demo.application.beverage_type,
        brand_name: demo.application.brand_name,
        class_type: demo.application.class_type,
        abv: String(demo.application.abv),
        net_contents: demo.application.net_contents,
      });
      setFiles({ front, back: back ?? null });
      setFieldErrors({});
      setExample(demo);
      setPhase({ name: "form" });
    } catch (err) {
      setExampleError(
        err instanceof Error
          ? err.message
          : "Couldn't load the example. Try again.",
      );
    } finally {
      setExampleBusy(false);
    }
  }

  async function handleSubmit() {
    const parsed = parseApplication(values);
    const errors: Record<string, string> = {};
    if (!parsed.ok) {
      // parseApplication messages are prefixed with the quoted field name.
      for (const message of parsed.errors) {
        const field = message.match(/^"([a-z_]+)"/)?.[1];
        if (!field) continue;
        const value = values[field as keyof FormValues];
        errors[field] =
          typeof value === "string" && value.trim() === ""
            ? (REQUIRED_MESSAGES[field] ?? message)
            : message;
      }
    }
    if (!files.front) {
      errors.front_image = "Add a photo of the front label.";
    }
    setFieldErrors(errors);
    if (!parsed.ok || !files.front) return;

    setPhase({ name: "checking", retrying: false });
    const outcome = await verifyLabelFiles(
      parsed.data,
      files.back ? [files.front, files.back] : [files.front],
      { votes: 3, onRetry: () => setPhase({ name: "checking", retrying: true }) },
    );
    if (outcome.ok) {
      setPhase({ name: "results", result: outcome.result });
    } else {
      setPhase({
        name: "form",
        error: { kind: outcome.kind, message: outcome.message },
      });
    }
  }

  if (phase.name === "results") {
    return (
      <ResultsView
        result={phase.result}
        files={files}
        onReset={() => {
          setValues(EMPTY_FORM);
          setFiles({ front: null, back: null });
          setFieldErrors({});
          setExample(null);
          setExampleError(null);
          setPhase({ name: "form" });
        }}
        onEdit={() => setPhase({ name: "form" })}
      />
    );
  }

  const checking = phase.name === "checking";
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-dashed bg-muted/40 px-3 py-2.5">
        <p className="text-sm text-muted-foreground">
          No label handy? Load a sample application and its label photos.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={loadExample}
          disabled={exampleBusy || checking}
        >
          {exampleBusy ? (
            <Spinner className="size-4" aria-hidden="true" />
          ) : (
            <ShuffleIcon aria-hidden="true" />
          )}
          {exampleBusy
            ? "Loading example…"
            : example
              ? "Try another example"
              : "Try an example"}
        </Button>
      </div>
      {exampleError && <p className="text-sm text-destructive">{exampleError}</p>}
      {example && (
        <ExampleNote example={example} onDismiss={() => setExample(null)} />
      )}
      {phase.name === "form" && phase.error && (
        <ErrorBanner kind={phase.error.kind} message={phase.error.message} />
      )}
      <ApplicationForm
        values={values}
        onValuesChange={(next) => {
          // Editing a field clears its stale error immediately.
          setFieldErrors((current) => {
            const cleared = { ...current };
            for (const key of Object.keys(next) as (keyof FormValues)[]) {
              if (next[key] !== values[key]) delete cleared[key];
            }
            return cleared;
          });
          setValues(next);
        }}
        files={files}
        onFilesChange={(next) => {
          if (next.front) {
            setFieldErrors((current) => {
              const { front_image, ...rest } = current;
              return front_image ? rest : current;
            });
          }
          setFiles(next);
        }}
        onSubmit={handleSubmit}
        busy={checking}
        busyText={
          checking && phase.retrying
            ? "Service is busy — retrying…"
            : "Checking label… this usually takes under 5 seconds."
        }
        fieldErrors={fieldErrors}
      />
    </div>
  );
}
