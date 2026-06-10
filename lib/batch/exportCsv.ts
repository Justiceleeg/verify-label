// Results CSV for the batch screen's Export button: one row per application,
// overall status plus per-field status and explanation columns, so flagged
// rows can be triaged or archived outside the tool.

import Papa from "papaparse";
import type { Verdict } from "@/core/types";
import type { BatchRow, RowState } from "./run";

const VERDICT_FIELDS: Verdict["field"][] = [
  "brand_name",
  "class_type",
  "alcohol_content",
  "proof",
  "net_contents",
  "government_warning",
  "same_field_of_vision",
];

/** Overall column value for rows that never produced verdicts. */
function overallFor(state: RowState): string {
  if (state.status === "done") return state.result.overall;
  if (state.status === "error") return "error";
  return "not_checked";
}

export function exportResultsCsv(rows: BatchRow[]): string {
  const records = rows.map((row) => {
    const record: Record<string, string | number> = {
      line: row.line,
      application_id: row.application.application_id,
      brand_name: row.application.brand_name,
      overall: overallFor(row.state),
      error: row.state.status === "error" ? row.state.message : "",
    };
    const verdicts = new Map<string, Verdict>(
      row.state.status === "done"
        ? row.state.result.verdicts.map((v) => [v.field, v])
        : [],
    );
    for (const field of VERDICT_FIELDS) {
      const verdict = verdicts.get(field);
      record[`${field}_status`] = verdict?.status ?? "";
      record[`${field}_explanation`] = verdict?.explanation ?? "";
    }
    return record;
  });

  return Papa.unparse(records, { newline: "\n" });
}
