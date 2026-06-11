// Thin shell over handler.ts — see docs/ARCHITECTURE.md "API".

import { checkBotId } from "botid/server";
import { createVerifyHandler } from "./handler";

const handleVerify = createVerifyHandler();

// BotID gate (client init: instrumentation-client.ts). Lives here, not in
// handler.ts, so the handler stays testable without a Vercel request context.
export async function POST(request: Request): Promise<Response> {
  // LOG-ONLY while BotID classification is being sorted out: it currently
  // flags every session as a bot (validation fails closed — likely needs the
  // project-level BotID toggle in the dashboard). Re-enable the 403 once the
  // logs show real sessions classified isBot: false.
  // checkLevel must match instrumentation-client.ts.
  try {
    const verification = await checkBotId({ advancedOptions: { checkLevel: "basic" } });
    console.warn("botid: classification", {
      isBot: verification.isBot,
      reason: "classificationReason" in verification ? verification.classificationReason : undefined,
      verifiedBot: verification.isVerifiedBot,
      bypassed: verification.bypassed,
    });
  } catch (err) {
    console.warn("botid: checkBotId threw", err instanceof Error ? err.message : err);
  }
  return handleVerify(request);
}

// Vision call is ~3–4s; headroom covers the upstream SDK's retry-on-429.
export const maxDuration = 30;
