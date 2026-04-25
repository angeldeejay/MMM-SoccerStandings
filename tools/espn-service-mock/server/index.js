/**
 * Standalone fixture-backed ESPN mock service.
 *
 * Start this tool when you want the module or the sandbox to consume local
 * deterministic API responses without baking that concern into the harness.
 */
const express = require("express");
const { createEspnServiceMockRouter } = require("./router");

const host = process.env.ESPN_SERVICE_MOCK_HOST || "127.0.0.1";
const port = Number(process.env.ESPN_SERVICE_MOCK_PORT) || 3200;

const app = express();
app.use(createEspnServiceMockRouter());

app.listen(port, host, () => {
	console.log(`[espn-service-mock] listening at http://${host}:${port}`);
});
