// BotID client init: attaches classification headers to requests hitting the
// protected routes; the server side is checkBotId() in app/api/verify/route.ts.
import { initBotId } from "botid/client/core";

initBotId({
  protect: [{ path: "/api/verify", method: "POST" }],
});
