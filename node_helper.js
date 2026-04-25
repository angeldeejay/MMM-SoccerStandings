/* MagicMirror²
 * Node Helper:  MMM-SoccerStandings
 *
 * By: Assistant
 * MIT Licensed.
 *
 * This node helper fetches canonical competition payloads from the active API provider.
 */

const NodeHelper = require("node_helper");
const Log = require("logger");
const CacheManager = require("./cache-manager.js");
const {
	buildCanonicalCacheKey,
	getDefaultSlug,
	isSupportedCanonicalCompetition
} = require("./backend/slice1-flat-standings.js");
const {
	initializeCanonicalProvider
} = require("./backend/canonical-provider-registry.js");
require("./backend/providers/espn-soccer-canonical-provider.js");

module.exports = NodeHelper.create({
	// Helper to send debug info to frontend for browser console viewing
	sendDebugInfo(message, data = null) {
		if (this.config && this.config.debug) {
			this.sendSocketNotification("DEBUG_INFO", {
				message: message,
				data: data,
				timestamp: new Date().toISOString()
			});
		}
	},

	/**
	 * Categorize errors and provide user-friendly messages
	 * @param {Error} error - The error object
	 * @returns {Object} Error with category and user-friendly message
	 */
	categorizeError(error) {
		const errorMsg = error.message || String(error);
		const errorName = error.name || "Error";

		let category = "Unknown";
		let userMessage = "An unexpected error occurred";
		let suggestion = "Please try again later";
		let icon = "⚠️";

		// Network errors (timeout, connection)
		if (
			errorName === "AbortError" ||
			errorMsg.includes("timeout") ||
			errorMsg.includes("ETIMEDOUT") ||
			errorMsg.includes("ECONNREFUSED") ||
			errorMsg.includes("ENOTFOUND")
		) {
			category = "Network";
			userMessage = "Network timeout - check your internet connection";
			suggestion = "Verify internet connection and try again";
			icon = "🌐";
		}
		// HTTP 4xx errors (client errors)
		else if (errorMsg.match(/HTTP 4\d{2}/)) {
			category = "Server";
			userMessage = "Data source unavailable - please try again later";
			suggestion = "The website may be temporarily down";
			icon = "🚫";
		}
		// HTTP 5xx errors (server errors)
		else if (errorMsg.match(/HTTP 5\d{2}/)) {
			category = "Server";
			userMessage = "Server error - data source is experiencing issues";
			suggestion = "Wait a few minutes and try again";
			icon = "🔧";
		}
		// Parsing errors
		else if (
			errorMsg.includes("parse") ||
			errorMsg.includes("JSON") ||
			(errorMsg.includes("No") && errorMsg.includes("data"))
		) {
			category = "Parsing";
			userMessage = "Data format changed - module may need update";
			suggestion = "Check for module updates";
			icon = "📋";
		}
		// Fetch errors
		else if (errorMsg.includes("fetch") || errorMsg.includes("request")) {
			category = "Network";
			userMessage = "Failed to fetch data";
			suggestion = "Check network connection";
			icon = "📡";
		}

		return {
			category,
			userMessage,
			suggestion,
			icon,
			originalError: errorMsg,
			code: error.code || "UNKNOWN"
		};
	},

	ensurePayloadMeta(data) {
		if (!data) return data;

		if (!data.meta) {
			data.meta = {
				lastUpdated: data.lastUpdated || new Date().toISOString(),
				source: data.source || "Unknown"
			};
		}

		return data;
	},

	// Node helper started
	start() {
		Log.info("Starting node helper for: MMM-SoccerStandings");
		this.config = null;

		// Initialize cache manager
		this.cache = new CacheManager(__dirname);

		this.competitionCatalogCache = {
			fetchedAt: 0,
			bySlug: {}
		};

		// Start periodic cache cleanup
		this.startCacheCleanup();
	},

	// Handle socket notifications from the module
	async socketNotificationReceived(notification, payload) {
		if (notification === "GET_COMPETITION_PAYLOAD") {
			this.config = payload;
			this.sendDebugInfo(
				"Received canonical request for " + payload.leagueType
			);
			await this.fetchCanonicalCompetitionPayload(payload);
		} else if (notification === "CACHE_GET_STATS") {
			const stats = await this.cache.getStats();
			this.sendSocketNotification("CACHE_STATS", stats);
		} else if (notification === "CACHE_CLEAR_ALL") {
			const cleared = await this.cache.clearAll();

			this.sendSocketNotification("CACHE_CLEARED", { cleared: cleared });
			Log.info(
				` MMM-SoccerStandings: All caches cleared (${cleared} disk files removed)`
			);
		} else if (notification === "CACHE_CLEANUP") {
			const deleted = await this.cache.cleanupExpired();
			this.sendSocketNotification("CACHE_CLEANUP_DONE", { deleted: deleted });
			Log.info(
				` MMM-SoccerStandings: Cache cleanup complete (${deleted} expired files removed)`
			);
		}
	},

	emitCanonicalCompetitionPayload(payload) {
		this.sendSocketNotification("COMPETITION_PAYLOAD", payload);
	},

	getCanonicalCompetitionProvider(providerId = "espn_service") {
		return initializeCanonicalProvider(providerId, {
			fetchJson: this._fetchServiceJson.bind(this),
			collectPages: this._collectPages.bind(this),
			catalogCache: this.competitionCatalogCache
		});
	},

	async fetchCanonicalCompetitionPayload(request) {
		const leagueType = request && request.leagueType;
		if (!leagueType || !isSupportedCanonicalCompetition(leagueType)) {
			return;
		}

		const debug = request && request.debug;
		const slug = request.slug || getDefaultSlug(leagueType);
		const wantsFixtures = Boolean(
			request && request.surfaces && request.surfaces.fixtures
		);
		const provider = this.getCanonicalCompetitionProvider(
			(request && request.provider) || "espn_service"
		);
		const cacheKey = buildCanonicalCacheKey(leagueType, {
			fixtures: wantsFixtures
		});
		const cachedPayload = await this.cache.get(cacheKey);

		if (cachedPayload) {
			const stalePayload = {
				...cachedPayload,
				generatedAt: cachedPayload.generatedAt || new Date().toISOString(),
				state: {
					...(cachedPayload.state || {}),
					status: "stale",
					stale: true,
					partial: false,
					providerId:
						(cachedPayload.state && cachedPayload.state.providerId) ||
						"espn-soccer-api",
					providerName:
						(cachedPayload.state && cachedPayload.state.providerName) ||
						"ESPN Soccer API"
				},
				standings: cachedPayload.standings
					? {
							...cachedPayload.standings,
							stale: true
						}
					: null
			};
			this.emitCanonicalCompetitionPayload(stalePayload, request);
		}

		try {
			const payload = await provider.fetchCompetitionPayload({
				leagueType,
				slug,
				wantsFixtures,
				request
			});

			await this.cache.set(cacheKey, payload);
			this.emitCanonicalCompetitionPayload(payload, request);
		} catch (error) {
			if (debug) {
				Log.error(
					` MMM-SoccerStandings: [CANONICAL] Error for ${leagueType}: ${error.message}`
				);
			}

			if (cachedPayload) {
				return;
			}

			const errorInfo = this.categorizeError(error);
			this.sendSocketNotification("FETCH_ERROR", { ...errorInfo, leagueType });
		}
	},

	/**
	 * Fetch JSON from the local service (no rate-limiting queue needed for LAN).
	 * @param {string} url
	 * @returns {Promise<object>}
	 */
	async _fetchServiceJson(url, timeoutMs = 8000) {
		const http = require("http");
		return new Promise((resolve, reject) => {
			const req = http.get(url, { timeout: timeoutMs }, (res) => {
				if (res.statusCode !== 200) {
					reject(new Error(`ESPN Service HTTP ${res.statusCode}: ${url}`));
					res.resume();
					return;
				}
				let body = "";
				res.setEncoding("utf8");
				res.on("data", (chunk) => { body += chunk; });
				res.on("end", () => {
					try {
						resolve(JSON.parse(body));
					} catch (e) {
						reject(new Error(`ESPN Service JSON parse error: ${e.message}`));
					}
				});
			});
			req.on("timeout", () => {
				req.destroy();
				reject(new Error(`ESPN Service request timed out: ${url}`));
			});
			req.on("error", reject);
		});
	},

	/**
	 * Extract all results from a paginated response object.
	 * Only the first page is used (limit=500 should cover all soccer cases).
	 * @param {object} resp  { count, results, next, previous }
	 * @returns {object[]}
	 */
	_collectPages(resp) {
		if (!resp || !Array.isArray(resp.results)) return [];
		return resp.results;
	},

	startCacheCleanup() {
		const cleanupInterval = 6 * 60 * 60 * 1000; // 6 hours
		setInterval(async () => {
			const deleted = await this.cache.cleanupExpired();
			if (deleted > 0) {
				Log.info(
					` MMM-SoccerStandings: Automatic cache cleanup removed ${deleted} expired entries`
				);
			}
		}, cleanupInterval);

		if (this.config && this.config.debug) {
			Log.info(
				" MMM-SoccerStandings: Cache cleanup scheduled every 6 hours"
			);
		}
	}
});
