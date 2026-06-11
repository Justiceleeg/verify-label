// Thin shell over handler.ts — see docs/ARCHITECTURE.md "API".

import { checkBotId } from "botid/server";
import { createVerifyHandler } from "./handler";

const handleVerify = createVerifyHandler();

// BotID gate (client init: instrumentation-client.ts). Lives here, not in
// handler.ts, so the handler stays testable without a Vercel request context.
export async function POST(request: Request): Promise<Response> {
  const verification = await checkBotId();
  if (verification.isBot) {
    return Response.json(
      { error: "Automated requests are not allowed on this demo." },
      { status: 403 },
    );
  }
  return handleVerify(request);
}

// Vision call is ~3–4s; headroom covers the upstream SDK's retry-on-429.
export const maxDuration = 30;
