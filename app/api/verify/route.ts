// Thin shell over handler.ts — see docs/ARCHITECTURE.md "API".

import { createVerifyHandler } from "./handler";

export const POST = createVerifyHandler();

// Vision call is ~3–4s; headroom covers the upstream SDK's retry-on-429.
export const maxDuration = 30;
