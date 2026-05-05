/**
 * Standalone ESPN service mock — HTTP server entry point.
 *
 * Wraps the MSW handlers in a real HTTP server via `@mswjs/http-middleware`
 * so that `node_helper.js` (and the sandbox) can reach the mock at
 * http://127.0.0.1:3200 without any changes to production code.
 *
 * For in-process test interception (no port, no network) import `handlers`
 * directly from `./handlers` and use `setupServer(...handlers)` from
 * `msw/node`.
 *
 * Environment variables:
 *   ESPN_SERVICE_MOCK_HOST  — bind address (default: 127.0.0.1)
 *   ESPN_SERVICE_MOCK_PORT  — TCP port      (default: 3200)
 */
import { createServer } from "@mswjs/http-middleware";
import { handlers } from "./handlers.js";

const host = process.env.ESPN_SERVICE_MOCK_HOST ?? "127.0.0.1";
const port = Number(process.env.ESPN_SERVICE_MOCK_PORT) || 3200;

const app = createServer(...handlers);

app.listen(port, host, () => {
  console.log(`[espn-service-mock] listening at http://${host}:${port}`);
});
