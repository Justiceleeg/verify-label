// Validates untrusted input (API payload, CSV row, form) into
// ApplicationData with actionable per-field errors. Shared by the API route
// and the batch pre-flight, so both report the same messages.

import type { ApplicationData, BeverageType } from "./types";

export const BEVERAGE_TYPES: readonly BeverageType[] = ["spirits", "wine", "malt"];

export type ApplicationParseResult =
  | { ok: true; data: ApplicationData }
  | { ok: false; errors: string[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseString(
  raw: unknown,
  field: string,
  errors: string[],
): string | null {
  if (typeof raw !== "string" || raw.trim() === "") {
    errors.push(`"${field}" is required and must be a non-empty string.`);
    return null;
  }
  return raw.trim();
}

/** Accepts a number or a numeric string ("45", "45.5", "45%"). */
function parseAbv(raw: unknown, errors: string[]): number | null {
  let value: number;
  if (typeof raw === "number") {
    value = raw;
  } else if (typeof raw === "string" && raw.trim() !== "") {
    value = Number(raw.trim().replace(/%$/, ""));
  } else {
    errors.push('"abv" is required and must be a number, e.g. 45 for 45% alc/vol.');
    return null;
  }
  if (!Number.isFinite(value) || value <= 0 || value >= 100) {
    errors.push(
      `"abv" must be a number between 0 and 100 (got ${JSON.stringify(raw)}).`,
    );
    return null;
  }
  return value;
}

function parseBeverageType(raw: unknown, errors: string[]): BeverageType | null {
  if (typeof raw === "string") {
    const normalized = raw.trim().toLowerCase();
    if ((BEVERAGE_TYPES as readonly string[]).includes(normalized)) {
      return normalized as BeverageType;
    }
  }
  errors.push(
    `"beverage_type" must be one of ${BEVERAGE_TYPES.join(", ")} (got ${JSON.stringify(raw)}).`,
  );
  return null;
}

export function parseApplication(input: unknown): ApplicationParseResult {
  if (!isRecord(input)) {
    return { ok: false, errors: ["Application data must be a JSON object."] };
  }

  const errors: string[] = [];
  const application_id = parseString(input.application_id, "application_id", errors);
  const beverage_type = parseBeverageType(input.beverage_type, errors);
  const brand_name = parseString(input.brand_name, "brand_name", errors);
  const class_type = parseString(input.class_type, "class_type", errors);
  const abv = parseAbv(input.abv, errors);
  const net_contents = parseString(input.net_contents, "net_contents", errors);

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    data: {
      application_id: application_id!,
      beverage_type: beverage_type!,
      brand_name: brand_name!,
      class_type: class_type!,
      abv: abv!,
      net_contents: net_contents!,
    },
  };
}
