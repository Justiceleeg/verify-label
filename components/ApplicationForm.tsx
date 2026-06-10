"use client";

// The application-data form: six fields mirroring ApplicationData, two image
// slots, one primary action. Values are strings; the container validates with
// core's parseApplication so the form and the API reject the same things.

import { useId } from "react";
import type { BeverageType } from "@/core/types";
import { ImagePicker } from "./ImagePicker";

export interface FormValues {
  application_id: string;
  beverage_type: BeverageType;
  brand_name: string;
  class_type: string;
  abv: string;
  net_contents: string;
}

export const EMPTY_FORM: FormValues = {
  application_id: "",
  beverage_type: "spirits",
  brand_name: "",
  class_type: "",
  abv: "",
  net_contents: "",
};

const BEVERAGE_OPTIONS: { value: BeverageType; label: string }[] = [
  { value: "spirits", label: "Distilled spirits" },
  { value: "wine", label: "Wine" },
  { value: "malt", label: "Malt beverage" },
];

interface ApplicationFormProps {
  values: FormValues;
  onValuesChange: (values: FormValues) => void;
  files: { front: File | null; back: File | null };
  onFilesChange: (files: { front: File | null; back: File | null }) => void;
  onSubmit: () => void;
  busy: boolean;
  busyText: string;
  /** Keyed by ApplicationData field name, plus "front_image". */
  fieldErrors: Record<string, string>;
}

function Field({
  id,
  label,
  error,
  suffix,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  suffix?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      <div className="flex items-center gap-2">
        {children}
        {suffix && (
          <span className="whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
            {suffix}
          </span>
        )}
      </div>
      {error && (
        <p id={`${id}-error`} className="mt-1 text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

export function ApplicationForm({
  values,
  onValuesChange,
  files,
  onFilesChange,
  onSubmit,
  busy,
  busyText,
  fieldErrors,
}: ApplicationFormProps) {
  const idPrefix = useId();

  const inputClasses =
    "w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base " +
    "focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 " +
    "disabled:opacity-50 dark:border-gray-700 dark:bg-gray-950";

  function textInput(
    field: keyof Omit<FormValues, "beverage_type">,
    label: string,
    options: { placeholder?: string; suffix?: string; type?: string; step?: string } = {},
  ) {
    const id = `${idPrefix}-${field}`;
    const error = fieldErrors[field];
    return (
      <Field id={id} label={label} error={error} suffix={options.suffix}>
        <input
          id={id}
          type={options.type ?? "text"}
          step={options.step}
          value={values[field]}
          onChange={(e) => onValuesChange({ ...values, [field]: e.target.value })}
          placeholder={options.placeholder}
          disabled={busy}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={inputClasses}
        />
      </Field>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      noValidate
      className="flex flex-col gap-5"
    >
      {textInput("application_id", "Application ID", { placeholder: "e.g. APP-001" })}

      <fieldset>
        <legend className="mb-1 block text-sm font-medium">Beverage type</legend>
        <div className="grid grid-cols-3 gap-2">
          {BEVERAGE_OPTIONS.map((option) => {
            const selected = values.beverage_type === option.value;
            return (
              <label
                key={option.value}
                className={`cursor-pointer rounded-lg border px-2 py-3 text-center text-sm font-medium ${
                  selected
                    ? "border-blue-600 bg-blue-50 text-blue-900 dark:bg-blue-950 dark:text-blue-200"
                    : "border-gray-300 hover:border-gray-400 dark:border-gray-700 dark:hover:border-gray-500"
                } ${busy ? "cursor-not-allowed opacity-50" : ""}`}
              >
                <input
                  type="radio"
                  name={`${idPrefix}-beverage_type`}
                  value={option.value}
                  checked={selected}
                  onChange={() =>
                    onValuesChange({ ...values, beverage_type: option.value })
                  }
                  disabled={busy}
                  className="sr-only"
                />
                {option.label}
              </label>
            );
          })}
        </div>
      </fieldset>

      {textInput("brand_name", "Brand name", { placeholder: "e.g. Old Tom Distillery" })}
      {textInput("class_type", "Class/type", {
        placeholder: "e.g. Kentucky Straight Bourbon Whiskey",
      })}
      {textInput("abv", "Alcohol content", {
        placeholder: "e.g. 45",
        suffix: "% alc/vol",
        type: "number",
        step: "0.1",
      })}
      {textInput("net_contents", "Net contents", { placeholder: "e.g. 750 mL" })}

      <ImagePicker
        label="Front label image"
        file={files.front}
        onChange={(front) => onFilesChange({ ...files, front })}
        disabled={busy}
        error={fieldErrors.front_image}
      />
      <ImagePicker
        label="Back label image"
        helper="Optional — the government warning is usually on the back."
        file={files.back}
        onChange={(back) => onFilesChange({ ...files, back })}
        disabled={busy}
      />

      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-blue-700 px-6 py-3.5 text-lg font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
      >
        {busy ? (
          <span className="inline-flex items-center gap-2" role="status">
            <span
              aria-hidden="true"
              className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"
            />
            {busyText}
          </span>
        ) : (
          "Check label"
        )}
      </button>
    </form>
  );
}
