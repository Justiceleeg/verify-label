"use client";

// Single-label checker container: phase state machine (form → checking →
// results), client-side validation via core's parseApplication, and the call
// into lib/verifyLabel. Form values and files survive every transition, so
// errors and "edit and re-check" never lose the agent's input.

import { useEffect, useRef, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { parseApplication } from "@/core/application";
import type { VerificationResult } from "@/core/types";
import { verifyLabelFiles, type VerifyFailureKind } from "@/lib/verifyLabel";
import { ApplicationForm, EMPTY_FORM, type FormValues } from "./ApplicationForm";
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

export function SingleLabelChecker() {
  const [values, setValues] = useState<FormValues>(EMPTY_FORM);
  const [files, setFiles] = useState<{ front: File | null; back: File | null }>({
    front: null,
    back: null,
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [phase, setPhase] = useState<Phase>({ name: "form" });

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
      { onRetry: () => setPhase({ name: "checking", retrying: true }) },
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
          setPhase({ name: "form" });
        }}
        onEdit={() => setPhase({ name: "form" })}
      />
    );
  }

  const checking = phase.name === "checking";
  return (
    <div className="flex flex-col gap-5">
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
