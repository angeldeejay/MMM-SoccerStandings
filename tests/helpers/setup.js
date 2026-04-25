/**
 * Shared test setup: registers globals and exposes loadRegisteredModuleDefinition.
 * Required once per test run (Node module cache ensures single execution).
 */
require("../../backend/providers/espn-soccer-canonical-provider.js");
require("../../competition-provider.js");
require("../../canonical-view-adapter.js");
require("../../providers/competition-provider-espn-service.js");

function loadRegisteredModuleDefinition() {
	const modulePath = require.resolve("../../MMM-SoccerStandings.js");
	const originalModule = global.Module;
	const originalLog = global.Log;
	let registeredModule = null;

	delete require.cache[modulePath];
	global.Module = {
		register(_name, definition) {
			registeredModule = definition;
			return definition;
		}
	};
	global.Log = {
		info() {},
		warn() {},
		error() {}
	};

	require(modulePath);

	if (typeof originalModule === "undefined") {
		delete global.Module;
	} else {
		global.Module = originalModule;
	}

	if (typeof originalLog === "undefined") {
		delete global.Log;
	} else {
		global.Log = originalLog;
	}

	return registeredModule;
}

module.exports = { loadRegisteredModuleDefinition };
