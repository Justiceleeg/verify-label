import Papa from "papaparse";
import { describe, expect, it } from "vitest";
import type { VerificationResult } from "@/core/types";
import type { BatchRow } from "./run";
import { exportResultsCsv } from "./exportCsv";

const application = {
  application_id: "APP-001",
  beverage_type: "spirits" as const,
  brand_name: "Old Tom Distillery",
  class_type: "Bourbon",
  abv: 45,
  net_contents: "750 mL",
};

const result: VerificationResult = {
  extracted: {} as VerificationResult["extracted"],
  verdicts: [
    {
      field: "brand_name",
      status: "match",
      label_value: "Old Tom Distillery",
      application_value: "Old Tom Distillery",
      explanation: "Exact match.",
    },
    {
      field: "government_warning",
      status: "mismatch",
      label_value: null,
      application_value: "GOVERNMENT WARNING: …",
      explanation: "The government warning is missing from the label.",
    },
  ],
  overall: "fail",
};

describe("exportResultsCsv", () => {
  it("writes one row per application with overall and per-field columns", () => {
    const rows: BatchRow[] = [
      {
        line: 2,
        application,
        imageNames: ["front.png"],
        state: { status: "done", result },
      },
      {
        line: 3,
        application: { ...application, application_id: "APP-002" },
        imageNames: ["front.png"],
        state: {
          status: "error",
          kind: "extraction",
          message: "upstream failure",
          retryable: true,
        },
      },
    ];

    const csv = exportResultsCsv(rows);
    const parsed = Papa.parse<Record<string, string>>(csv, { header: true });

    expect(parsed.data).toHaveLength(2);
    const [done, errored] = parsed.data;
    expect(done).toMatchObject({
      line: "2",
      application_id: "APP-001",
      brand_name: "Old Tom Distillery",
      overall: "fail",
      error: "",
      brand_name_status: "match",
      government_warning_status: "mismatch",
      government_warning_explanation: "The government warning is missing from the label.",
      // Fields without a verdict stay blank rather than implying a status.
      proof_status: "",
    });
    expect(errored).toMatchObject({
      application_id: "APP-002",
      overall: "error",
      error: "upstream failure",
      brand_name_status: "",
    });
  });

  it("marks rows that never ran as not_checked", () => {
    const csv = exportResultsCsv([
      { line: 2, application, imageNames: [], state: { status: "pending" } },
    ]);
    const parsed = Papa.parse<Record<string, string>>(csv, { header: true });

    expect(parsed.data[0].overall).toBe("not_checked");
  });
});
