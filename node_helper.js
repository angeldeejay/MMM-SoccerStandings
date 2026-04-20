/* MagicMirror²
 * Node Helper:  MMM-SoccerStandings
 *
 * By: Assistant
 * MIT Licensed.
 *
 * This node helper fetches soccer league standings from multiple providers
 * (BBC Sport, ESPN, Soccerway, Wikipedia, Google) and processes them for display.
 */

const SharedRequestManager = require("./shared-request-manager.js");

const requestManager = SharedRequestManager.getInstance();
const NodeHelper = require("node_helper");
const CacheManager = require("./cache-manager.js");
const BBCParser = require("./BBCParser.js");
const FIFAParser = require("./FIFAParser.js");
const SoccerwayParser = require("./SoccerwayParser.js");
const WikipediaParser = require("./WikipediaParser.js");
const ESPNParser = require("./ESPNParser.js");
const GoogleParser = require("./GoogleParser.js");
const logoResolver = require("./logo-resolver.js");

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
			errorMsg.includes("No") && errorMsg.includes("data")
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

	/**
	 * Resolves logos for all teams in the data payload.
	 * Moves logic from client to server to improve performance on low-power devices.
	 *
	 * @param {Object} data - The league data payload
	 * @param {Object} config - The module configuration
	 * @returns {Object} - Data with resolved logo paths
	 */
	resolveLogos(data, config) {
		if (!data) return data;

		// Normalise meta: parsers write lastUpdated/source at root level;
		// frontend expects data.meta.lastUpdated for dedup and display.
		if (!data.meta) {
			data.meta = {
				lastUpdated: data.lastUpdated || new Date().toISOString(),
				source: data.source || "Unknown"
			};
		}

		const customMappings = (config && config.teamLogoMap) || {};
		const debug = config && config.debug;

		if (debug)
			console.log(
				" MMM-SoccerStandings: Resolving logos on server-side..."
			);

		// Pre-compute once — avoids JSON.stringify(customMappings) per team lookup
		const customMappingsKey = Object.keys(customMappings).length > 0
			? JSON.stringify(customMappings)
			: "";

		// Helper to get logo with caching
		const getCachedLogo = (teamName) => {
			const cacheKey = customMappingsKey ? `${teamName}_${customMappingsKey}` : teamName;
			if (this.resolvedLogoCache.has(cacheKey)) {
				return this.resolvedLogoCache.get(cacheKey);
			}
			const logo = logoResolver.getLogo(teamName, customMappings);
			this.resolvedLogoCache.set(cacheKey, logo);
			return logo;
		};

		// 1. Resolve logos for standard league tables
		if (data.teams && Array.isArray(data.teams)) {
			data.teams.forEach((team) => {
				if (team.name) {
					team.logo = getCachedLogo(team.name);
				}
			});
		}

		// 2. Resolve logos for groups (World Cup/UEFA)
		if (data.groups) {
			Object.keys(data.groups).forEach((groupName) => {
				if (Array.isArray(data.groups[groupName])) {
					data.groups[groupName].forEach((team) => {
						if (team.name) {
							team.logo = getCachedLogo(team.name);
						}
					});
				}
			});
		}

		// 2b. Resolve logos for split-league multi-group data (Romania, Austria etc.)
		if (Array.isArray(data.splitGroups)) {
			data.splitGroups.forEach((group) => {
				if (Array.isArray(group.teams)) {
					group.teams.forEach((team) => {
						if (team.name) team.logo = getCachedLogo(team.name);
					});
				}
			});
		}

		// 3. Resolve logos for fixtures
		if (data.fixtures && Array.isArray(data.fixtures)) {
			data.fixtures.forEach((fixture) => {
				if (fixture.homeTeam) {
					fixture.homeLogo = getCachedLogo(fixture.homeTeam);
				}
				if (fixture.awayTeam) {
					fixture.awayLogo = getCachedLogo(fixture.awayTeam);
				}
			});
		}

		// 4. Resolve logos for knockout stages
		if (data.knockouts) {
			Object.keys(data.knockouts).forEach((stage) => {
				if (Array.isArray(data.knockouts[stage])) {
					data.knockouts[stage].forEach((fixture) => {
						if (fixture.homeTeam) {
							fixture.homeLogo = getCachedLogo(fixture.homeTeam);
						}
						if (fixture.awayTeam) {
							fixture.awayLogo = getCachedLogo(fixture.awayTeam);
						}
					});
				}
			});
		}

		// 5. Resolve logos for uefaStages (Task: Staged Approach)
		if (data.uefaStages) {
			["results", "today", "future"].forEach((sKey) => {
				if (Array.isArray(data.uefaStages[sKey])) {
					data.uefaStages[sKey].forEach((fixture) => {
						if (fixture.homeTeam)
							fixture.homeLogo = getCachedLogo(fixture.homeTeam);
						if (fixture.awayTeam)
							fixture.awayLogo = getCachedLogo(fixture.awayTeam);
					});
				}
			});
		}

		return data;
	},

	// Node helper started
	start() {
		console.info("Starting node helper for: MMM-SoccerStandings");
		this.config = null;

		// Initialize cache manager
		this.cache = new CacheManager(__dirname);

		// Monthly fixture cache to track last fetch time per month (P-03)
		this.fixtureCache = {};

		// Server-side logo cache to reduce lookup overhead
		this.resolvedLogoCache = new Map();

		// Initialize parsers
		this.bbcParser = new BBCParser();
		this.fifaParser = new FIFAParser();
		this.soccerwayParser = new SoccerwayParser();
		this.wikipediaParser = new WikipediaParser();
		this.espnParser = new ESPNParser();
		this.googleParser = new GoogleParser();

		// Start periodic cache cleanup
		this.startCacheCleanup();

		// Configure shared request manager
		requestManager.updateConfig({
			minRequestInterval: 2000,
			minDomainInterval: 1000,
			maxRetries: 3,
			requestTimeout: 10000
		});
	},

	// Handle socket notifications from the module
	async socketNotificationReceived(notification, payload) {
		if (notification === "GET_LEAGUE_DATA") {
			this.config = payload;
			// Propagate config to all registered parsers
			if (this.bbcParser) this.bbcParser.setConfig(payload);
			if (this.fifaParser) this.fifaParser.setConfig(payload);
			if (this.soccerwayParser) this.soccerwayParser.setConfig(payload);
			if (this.wikipediaParser) this.wikipediaParser.setConfig(payload);
			if (this.espnParser) this.espnParser.setConfig(payload);
			if (this.googleParser) this.googleParser.setConfig(payload);

			this.sendDebugInfo("Received request for " + payload.leagueType);
			this.fetchLeagueData(payload.url, payload.leagueType, payload);
		} else if (notification === "CACHE_GET_STATS") {
			const stats = await this.cache.getStats();
			this.sendSocketNotification("CACHE_STATS", stats);
		} else if (notification === "CACHE_CLEAR_ALL") {
			const cleared = await this.cache.clearAll();

			// Also clear in-memory caches
			this.fixtureCache = {};
			this.resolvedLogoCache.clear();

			this.sendSocketNotification("CACHE_CLEARED", { cleared: cleared });
			console.info(
				` MMM-SoccerStandings: All caches cleared (${cleared} disk files removed, fixture cache reset, logo cache reset)`
			);
		} else if (notification === "CACHE_CLEANUP") {
			const deleted = await this.cache.cleanupExpired();
			this.sendSocketNotification("CACHE_CLEANUP_DONE", { deleted: deleted });
			console.info(
				` MMM-SoccerStandings: Cache cleanup complete (${deleted} expired files removed)`
			);
		}
	},

	// Helper: select the appropriate parser instance and display name for a given provider string.
	// Provider is detected from the explicit provider name or inferred from the URL domain.
	_getParser(providerName, url) {
		const p = (providerName || "auto").toLowerCase();
		const u = url || "";
		if (p === "google" || (p === "auto" && u.includes("google.com"))) {
			return { parser: this.googleParser, name: "Google Search" };
		}
		if (p === "fifa" || (p === "auto" && u.includes("fifa.com"))) {
			return { parser: this.fifaParser, name: "FIFA.com" };
		}
		if (p === "soccerway" || (p === "auto" && u.includes("soccerway.com"))) {
			return { parser: this.soccerwayParser, name: "Soccerway" };
		}
		if (p === "wikipedia" || (p === "auto" && u.includes("wikipedia.org"))) {
			return { parser: this.wikipediaParser, name: "Wikipedia" };
		}
		if (p === "espn" || (p === "auto" && u.includes("espn.com"))) {
			return { parser: this.espnParser, name: "ESPN" };
		}
		return { parser: this.bbcParser, name: "BBC Sport" };
	},

	// Main function to fetch league data.
	// chainIndex: position within config.providerChain (0 = primary, 1+ = fallback providers).
	// isFallback is kept for backward compatibility when providerChain is not set.
	async fetchLeagueData(url, leagueType, config, chainIndex = 0) {
		const debug = config && config.debug;
		const useMockData = config && config.useMockData;
		const providerChain = (config && Array.isArray(config.providerChain))
			? config.providerChain
			: [];

		// Determine current provider from chain entry or fall back to config.provider / auto-detect.
		const chainEntry = providerChain[chainIndex];
		const currentProviderStr = chainEntry
			? chainEntry.provider
			: (config && config.provider ? config.provider : "auto");

		if (debug) {
			const chainInfo = providerChain.length > 0
				? `Chain [${chainIndex + 1}/${providerChain.length}]`
				: "Single";
			console.log(
				` MMM-SoccerStandings: Fetching ${leagueType} (${chainInfo}, Provider: ${currentProviderStr})...`
			);
			this.cache.setDebug(true);
		}

		// Convenience: tries the next provider in the chain or falls to cache.
		const tryNextProvider = async (reason) => {
			const nextIdx = chainIndex + 1;
			if (nextIdx < providerChain.length) {
				if (debug) {
					console.log(
						` MMM-SoccerStandings: [${leagueType}] ${reason}. Trying next provider: ${providerChain[nextIdx].provider}`
					);
				}
				return this.fetchLeagueData(
					providerChain[nextIdx].url,
					leagueType,
					config,
					nextIdx
				);
			}

			// Legacy single fallbackUrl support (when no providerChain is available).
			const legacyFallback = config && config.fallbackUrl;
			if (legacyFallback && chainIndex === 0 && providerChain.length === 0) {
				if (debug) {
					console.log(
						` MMM-SoccerStandings: [${leagueType}] ${reason}. Trying legacy fallbackUrl.`
					);
				}
				return this.fetchLeagueData(legacyFallback, leagueType, config, 999);
			}

			return null; // Signals caller to fall through to cache-only handling.
		};

		// Handle Mock Data for non-WC leagues (simulated)
		if (useMockData && leagueType !== "WORLD_CUP_2026") {
			if (debug)
				console.log(
					` MMM-SoccerStandings: [MOCK MODE] Generating mock data for ${leagueType}`
				);
			const cachedData = await this.cache.get(leagueType);
			if (cachedData) {
				cachedData.leagueType = leagueType;
				cachedData.fromCache = true;
				cachedData.isMock = true;
				this.sendSocketNotification(
					"LEAGUE_DATA",
					this.resolveLogos(cachedData, config)
				);
				return;
			}
		}

		// Handle UEFA competitions with separate table and fixture URLs
		if (typeof url === "object" && url !== null && url.table && url.fixtures) {
			return this.fetchUEFACompetitionData(url, leagueType, config);
		}

		// Handle FIFA World Cup 2026 specifically if needed
		if (leagueType === "WORLD_CUP_2026") {
			return this.fetchFIFAWorldCup2026(url, config);
		}

		// PROACTIVE CACHING: Serve any valid cached data immediately while a fresh fetch runs.
		// Only do this on the first attempt (chainIndex === 0) to avoid repeat sends.
		if (chainIndex === 0) {
			const cachedData = await this.cache.get(leagueType);
			if (cachedData) {
				const isValid = this.isDataComplete(cachedData, leagueType, config && config.splitConfig);
				if (debug) {
					console.log(
						` MMM-SoccerStandings: [${leagueType}] Cached data is ${isValid ? "complete" : "incomplete"}`
					);
				}
				if (isValid) {
					cachedData.leagueType = leagueType;
					cachedData.fromCache = true;
					this.sendSocketNotification(
						"LEAGUE_DATA",
						this.resolveLogos(cachedData, config)
					);
				}
			}
		}

		// Select the right parser for the current URL / provider.
		const { parser, name: providerName } = this._getParser(currentProviderStr, url);

		try {
			const html = await this.fetchWebPage(url);
			if (debug) {
				console.log(
					` MMM-SoccerStandings: [${leagueType}] Fetched HTML from ${providerName} (${url.substring(0, 80)}...)`
				);
			}

			let leagueData = parser.parseLeagueData(html, leagueType, config.splitConfig || null);

			// For split leagues: detect when the parser returned the full pre-split table
			// instead of the post-split championship group. This happens because the
			// WikipediaParser (and others) may not have received splitConfig if the shared
			// parser's this.config was overwritten by a concurrent request (race condition).
			// The direct splitConfig param (above) fixes the race, but this guard catches
			// any residual cases where we still get too many teams.
			if (
				config.splitConfig &&
				leagueData &&
				Array.isArray(leagueData.teams) &&
				leagueData.teams.length > 0 &&
				!leagueData.splitGroups
			) {
				const splitCfg = config.splitConfig;
				// Use groups array sum when available (handles 3-group leagues like Belgium)
				const fullSeasonCount = Array.isArray(splitCfg.groups) && splitCfg.groups.length > 0
					? splitCfg.groups.reduce((sum, g) => sum + (g.size || 0), 0)
					: (splitCfg.championshipSize || 0) + (splitCfg.relegationSize || 0);
				// Determine how far into the season we are by taking the maximum
				// games-played value across all returned teams.
				const maxPlayed = leagueData.teams.reduce(
					(max, t) => Math.max(max, t.played || 0), 0
				);

				// Phase 2 is underway when at least the leading team has played
				// more games than the Phase 1 total (regularSeasonGames).
				const phase2Started = maxPlayed > splitCfg.regularSeasonGames;

				// Phase 1 is complete but Phase 2 groups have not been formed yet.
				// This is the normal transition window between the two phases.
				const awaitingSplitAnnouncement =
					!phase2Started && maxPlayed >= splitCfg.regularSeasonGames;

				if (awaitingSplitAnnouncement) {
					// Phase 1 is over but the split has not been announced yet.
					// Every provider will return the same full Phase 1 table right now,
					// so escalating to the next provider is pointless and wastes resources.
					// Mark the data with awaitingSplit so the frontend can display a
					// clear indicator (e.g. "Phase 1 Final / Awaiting Split").
					leagueData.awaitingSplit = true;
					if (debug) {
						console.log(
							` MMM-SoccerStandings: [${leagueType}] Phase 1 complete (max played: ${maxPlayed}/${splitCfg.regularSeasonGames}). Awaiting split announcement — serving Phase 1 final standings.`
						);
					}
				} else {
					// Phase 2 has started — check whether the returned table is correct.
					// Case 1: Provider returned the full pre-split table (wrong — too many teams).
					const gotPreSplitTable = phase2Started && leagueData.teams.length >= fullSeasonCount;
					// Case 2: Provider returned only one group when we need all groups.
					const gotSingleGroupOnly = phase2Started && splitCfg.showAllGroups && leagueData.teams.length < fullSeasonCount;

					if (gotPreSplitTable || gotSingleGroupOnly) {
						const escalateReason = gotPreSplitTable
							? `Phase 2 started but pre-split full table returned (${leagueData.teams.length} teams, expected ${splitCfg.championshipSize})`
							: `Phase 2 started but single-group table returned (${leagueData.teams.length} teams) while showAllGroups=true`;
						if (debug) {
							console.log(
								` MMM-SoccerStandings: [${leagueType}] ${escalateReason}. Escalating to next provider.`
							);
						}
						const advanced = await tryNextProvider(escalateReason);
						if (advanced !== null) return;
						leagueData.incomplete = true;
					}
				}
			}

			if (leagueData && leagueData.teams && leagueData.teams.length > 0) {
				leagueData.leagueType = leagueType;
				leagueData.source = providerName;

				const isFreshComplete = this.isDataComplete(leagueData, leagueType, config && config.splitConfig);

				if (!isFreshComplete) {
					if (debug) {
						console.log(
							` MMM-SoccerStandings: [${leagueType}] Data from ${providerName} is incomplete (${leagueData.teams.length} teams, all-zero stats or no form).`
						);
					}

					// Check if the cache holds better data before escalating the chain.
					const existingCache = await this.cache.get(leagueType);
					if (existingCache && this.isDataComplete(existingCache, leagueType, config && config.splitConfig)) {
						if (debug) {
							console.log(
								` MMM-SoccerStandings: [${leagueType}] Cache has complete data; serving that instead.`
							);
						}
						existingCache.leagueType = leagueType;
						existingCache.fromCache = true;
						existingCache.cacheFallback = true;
						this.sendSocketNotification(
							"LEAGUE_DATA",
							this.resolveLogos(existingCache, config)
						);
						return;
					}

					// No usable cache - escalate to next provider in the chain.
					const advanced = await tryNextProvider(
						`${providerName} returned incomplete data`
					);
					if (advanced !== null) return; // Next provider handled it.

					// All providers exhausted; serve what we have with an incomplete flag.
					leagueData.incomplete = true;
				}

				await this.cache.set(leagueType, leagueData);
				this.sendDebugInfo("Sending LEAGUE_DATA for " + leagueType);
				this.sendSocketNotification(
					"LEAGUE_DATA",
					this.resolveLogos(leagueData, config)
				);
			} else {
				// Parser returned no teams - try next provider.
				const advanced = await tryNextProvider(
					`${providerName} returned no team data`
				);
				if (advanced !== null) return;

				throw new Error(`No ${leagueType} data parsed from any provider`);
			}
		} catch (error) {
			// HTTP / network error - try next provider before giving up.
			if (debug) {
				console.log(
					` MMM-SoccerStandings: [${leagueType}] Error from ${providerName}: ${error.message}`
				);
			}

			const advanced = await tryNextProvider(`${providerName} fetch/parse error`);
			if (advanced !== null) return;

			// All providers failed - log and fall back to cached data.
			this.sendDebugInfo("Error fetching " + leagueType, error.message);
			console.error(
				` MMM-SoccerStandings: All providers failed for ${leagueType}:`,
				error.message
			);

			const fallbackData = await this.cache.get(leagueType);
			if (fallbackData) {
				fallbackData.leagueType = leagueType;
				fallbackData.fromCache = true;
				fallbackData.cacheFallback = true;
				this.sendSocketNotification(
					"LEAGUE_DATA",
					this.resolveLogos(fallbackData, config)
				);
			} else {
				const errorInfo = this.categorizeError(error);
				this.sendSocketNotification("FETCH_ERROR", {
					...errorInfo,
					leagueType: leagueType
				});
			}
		}
	},

	/**
	 * Check if the league data is complete (e.g. contains form tokens)
	 * @param {Object} data - League data object
	 * @param {string} leagueType - League type
	 * @returns {boolean} - True if complete
	 */
	isDataComplete(data, leagueType, splitConfig) {
		if (
			!data ||
			!data.teams ||
			!Array.isArray(data.teams) ||
			data.teams.length === 0
		) {
			return false;
		}

		// For split leagues that require all groups: cached data lacking splitGroups is stale.
		// This prevents single-group BBC data from being served from cache for post-split leagues.
		// EXCEPTION: awaitingSplit data (Phase 1 final standings) is valid — the split simply
		// has not been announced yet.  Treat it as complete so it can be cached and served.
		if (splitConfig && splitConfig.showAllGroups && !data.splitGroups) {
			if (data.awaitingSplit) {
				return true;
			}
			return false;
		}

		// World Cup and other knockout-heavy leagues might not have form in the same way
		if (leagueType === "WORLD_CUP_2026" || leagueType.includes("UEFA")) {
			return true;
		}

		const debug = this.config && this.config.debug;

		// Check if ALL teams have zero stats (played, points, won all zero).
		// This indicates a stub or transitional page (e.g. BBC during a league-split period)
		// rather than genuine start-of-season data where the team count would be wrong too.
		// We require >3 teams to avoid false positives on tiny cup-phase groups.
		const allStatsZero = data.teams.length > 3 &&
			data.teams.every(
				(t) => (t.played || 0) === 0 && (t.points || 0) === 0 && (t.won || 0) === 0
			);

		if (allStatsZero) {
			if (debug) {
				console.log(
					` MMM-SoccerStandings: [isDataComplete] ${leagueType}: All ${data.teams.length} teams have zero stats - stub/split page detected, marking incomplete.`
				);
			}
			return false;
		}

		// Fallback providers (Wikipedia, ESPN, Google, Soccerway) do not supply form data.
		// For these sources, completeness is based on having non-zero stats rather than form.
		// BBC Sport is the only provider expected to supply form tokens.
		const fallbackSources = ["Wikipedia", "ESPN", "Google Search", "Soccerway"];
		const isFallbackSource = fallbackSources.includes(data.source);

		if (isFallbackSource) {
			// For fallback providers: data is complete if majority of teams have played games.
			const teamsWhoPlayed = data.teams.filter((t) => (t.played || 0) > 0);
			const complete = teamsWhoPlayed.length >= Math.ceil(data.teams.length * 0.5);
			if (debug) {
				console.log(
					` MMM-SoccerStandings: [isDataComplete] ${leagueType} (source: ${data.source}): ${teamsWhoPlayed.length}/${data.teams.length} teams played. Complete: ${complete}`
				);
			}
			return complete;
		}

		// For BBC Sport: check that at least some teams have form data.
		// Form is an array of result objects populated by the BBC parser.
		const teamsWithForm = data.teams.filter(
			(t) => Array.isArray(t.form) && t.form.length > 0
		);

		if (debug) {
			console.log(
				` MMM-SoccerStandings: [isDataComplete] ${leagueType}: ${teamsWithForm.length}/${data.teams.length} teams have form.`
			);
		}

		// If no teams have form, check whether games have been played.
		// If games have been played but no form is found, BBC is returning a stub page.
		if (data.teams.length > 0 && teamsWithForm.length === 0) {
			const teamsWhoPlayed = data.teams.filter((t) => (t.played || 0) > 0);
			if (teamsWhoPlayed.length > 0) {
				if (debug) {
					console.log(
						` MMM-SoccerStandings: [isDataComplete] ${leagueType} has played games but no form from BBC. Marking as incomplete.`
					);
				}
				return false;
			}
		}

		return teamsWithForm.length / data.teams.length > 0.5;
	},

	// Fetch and parse FIFA World Cup 2026 data
	async fetchFIFAWorldCup2026(url, config) {
		const leagueType = "WORLD_CUP_2026";
		const debug = config && config.debug;
		const useMockData = config && config.useMockData;

		try {
			// Handle Mock Data specifically for World Cup
			if (useMockData) {
				if (debug)
					console.log(
						" MMM-SoccerStandings: [MOCK MODE] Generating World Cup mock data"
					);
				this.fifaParser.setConfig(config);
				const mockData = this.fifaParser.generateMockWC2026Data();
				mockData.fromCache = false;
				mockData.isMock = true;
				this.sendSocketNotification(
					"LEAGUE_DATA",
					this.resolveLogos(mockData, config)
				);
				return;
			}

			// PROACTIVE CACHING: Serve cached World Cup data immediately
			const cachedData = await this.cache.get(leagueType);
			if (cachedData) {
				if (this.config && this.config.debug) {
					console.log(
						" MMM-SoccerStandings: Serving cached World Cup data immediately"
					);
				}
				cachedData.fromCache = true;
				this.fifaParser.setConfig(config);
				const resolvedCached =
					this.fifaParser.resolveWCPlaceholders(cachedData);
				this.sendSocketNotification(
					"LEAGUE_DATA",
					this.resolveLogos(resolvedCached, config)
				);
			}

			// Fetch both BBC pages: tables and fixtures
			// Handle single URL or array of URLs for fixtures
			const fixtureUrls = Array.isArray(url) ? url : [url];
			const tablesUrl = "https://www.bbc.co.uk/sport/football/world-cup/table";

			const fetchPromises = [this.fetchWebPage(tablesUrl)];
			fixtureUrls.forEach((fUrl) => fetchPromises.push(this.fetchWebPage(fUrl)));

			const [tablesHtml, ...fixturesHtmlParts] =
				await Promise.all(fetchPromises);

			// Parse groups from tables page
			this.fifaParser.setConfig(config);
			const groups = this.fifaParser.parseFIFAWorldCupTablesBBC(tablesHtml);

			// Parse fixtures from all fixture pages and merge them
			let allFixtures = [];
			fixturesHtmlParts.forEach((fHtml) => {
				const partData = this.fifaParser.parseFIFAWorldCupData("", fHtml);
				if (partData && partData.fixtures) {
					allFixtures = allFixtures.concat(partData.fixtures);
				}
			});

			// Deduplicate fixtures by matchNo
			const uniqueFixturesMap = new Map();
			allFixtures.forEach((f) => {
				if (f.matchNo) {
					uniqueFixturesMap.set(f.matchNo, f);
				} else {
					// For fixtures without matchNo (if any), use a synthetic key
					const key = `${f.date}_${f.homeTeam}_${f.awayTeam}`;
					uniqueFixturesMap.set(key, f);
				}
			});

			const mergedFixtures = Array.from(uniqueFixturesMap.values());

			// Create final data object
			let data = {
				groups: groups,
				fixtures: mergedFixtures,
				knockouts: {
					rd32: mergedFixtures.filter((f) => f.stage === "Rd32"),
					rd16: mergedFixtures.filter((f) => f.stage === "Rd16"),
					qf: mergedFixtures.filter((f) => f.stage === "QF"),
					sf: mergedFixtures.filter((f) => f.stage === "SF"),
					tp: mergedFixtures.filter((f) => f.stage === "TP"),
					final: mergedFixtures.filter((f) => f.stage === "Final")
				},
				lastUpdated: new Date().toISOString(),
				source: "BBC Sport",
				leagueType: leagueType
			};

			if (data && data.groups && Object.keys(data.groups).length > 0) {
				data.leagueType = leagueType;
				data = this.fifaParser.resolveWCPlaceholders(data);
				await this.cache.set(leagueType, data);
				this.sendSocketNotification(
					"LEAGUE_DATA",
					this.resolveLogos(data, config)
				);
			} else {
				throw new Error("No World Cup data parsed from website");
			}
		} catch (error) {
			console.error(
				" MMM-SoccerStandings: Error fetching World Cup data:",
				error.message
			);

			// Only fallback to cache if we haven't already served it during this fetch
			const fallbackData = await this.cache.get(leagueType);
			if (fallbackData) {
				console.log(
					" MMM-SoccerStandings: Using cached World Cup data as fallback"
				);
				fallbackData.fromCache = true;
				fallbackData.cacheFallback = true;
				const resolvedFallback =
					this.fifaParser.resolveWCPlaceholders(fallbackData);
				this.sendSocketNotification(
					"LEAGUE_DATA",
					this.resolveLogos(resolvedFallback, config)
				);
			} else {
				const errorInfo = this.categorizeError(error);
				this.sendSocketNotification("FETCH_ERROR", {
					...errorInfo,
					leagueType: leagueType
				});
			}
		}
	},

	// Fetch and parse UEFA Competition data (UCL, UEL, ECL)
	async fetchUEFACompetitionData(urls, leagueType, config) {
		try {
			// PROACTIVE CACHING: Serve cached data immediately
			const cachedData = await this.cache.get(leagueType);
			if (cachedData) {
				if (this.config && this.config.debug) {
					console.log(
						` MMM-SoccerStandings: Serving cached ${leagueType} data immediately`
					);
				}
				cachedData.leagueType = leagueType;
				cachedData.fromCache = true;
				this.sendSocketNotification(
					"LEAGUE_DATA",
					this.resolveLogos(cachedData, config)
				);
			}

			// DYNAMIC MONTH FETCHING: Fetch current month and next 4 months to ensure full knockout coverage
			const now = new Date();
			const currentYear = now.getFullYear();
			const currentMonth = now.getMonth(); // 0-11
			const formatMonth = (y, m) => `${y}-${String(m + 1).padStart(2, "0")}`;

			const monthsToFetch = [];
			const cachedMonthParts = [];

			for (let i = 0; i <= 4; i++) {
				const d = new Date(currentYear, currentMonth + i, 1);
				const monthStr = formatMonth(d.getFullYear(), d.getMonth());
				const isFuture = i > 0;
				const oneDay = 24 * 60 * 60 * 1000;

				// Check if we need to fetch this month's variants
				const baseKey = `${leagueType}_${monthStr}_base`;
				const resKey = `${leagueType}_${monthStr}_results`;
				const lastFetch = Math.min(
					this.fixtureCache[baseKey]?.timestamp || 0,
					this.fixtureCache[resKey]?.timestamp || 0
				);

				if (!isFuture || Date.now() - lastFetch > oneDay) {
					monthsToFetch.push(monthStr);
				} else {
					// Use cached parts
					if (this.fixtureCache[baseKey])
						cachedMonthParts.push(this.fixtureCache[baseKey].html);
					if (this.fixtureCache[resKey])
						cachedMonthParts.push(this.fixtureCache[resKey].html);
					if (config.debug)
						console.log(
							` MMM-SoccerStandings: Using cached variants for ${monthStr}`
						);
				}
			}

			const fixtureFetchPromises = [
				this.fetchWebPage(urls.fixtures)
					.then((html) => {
						// Also cache the base URL for current month
						const curMonthStr = formatMonth(currentYear, currentMonth);
						this.fixtureCache[`${leagueType}_${curMonthStr}_base`] = {
							html,
							timestamp: Date.now()
						};
						return html;
					})
					.catch(() => "")
			];

			monthsToFetch.forEach((month) => {
				const baseMonthlyUrl = `${urls.fixtures}/${month}`;
				// STAGED APPROACH: Results and Today/Future base URLs
				const variants = [
					{ url: baseMonthlyUrl, type: "base" },
					{ url: `${baseMonthlyUrl}?filter=results`, type: "results" }
				];

				variants.forEach((variant) => {
					fixtureFetchPromises.push(
						this.fetchWebPage(variant.url)
							.then((html) => {
								const cacheKey = `${leagueType}_${month}_${variant.type}`;
								this.fixtureCache[cacheKey] = { html, timestamp: Date.now() };
								return html;
							})
							.catch(() => "")
					);
				});

				// Legacy /fixtures/ fallback
				const legacyUrl =
					urls.fixtures.replace("scores-fixtures", "fixtures") + "/" + month;
				fixtureFetchPromises.push(this.fetchWebPage(legacyUrl).catch(() => ""));
			});

			const results = await Promise.all([
				this.fetchWebPage(urls.table).catch(() => ""),
				...fixtureFetchPromises
			]);

			const tablesHtml = results[0];
			const fetchedFixturesHtml = results.slice(1);
			const allFixturesHtmlParts = [
				...fetchedFixturesHtml,
				...cachedMonthParts
			];

			if (config.debug)
				console.log(
					` MMM-SoccerStandings: Parsing ${leagueType} with ${allFixturesHtmlParts.length} HTML parts`
				);

			this.bbcParser.setConfig(config);
			const leagueData = this.bbcParser.parseUEFACompetitionData(
				tablesHtml,
				allFixturesHtmlParts,
				leagueType
			);

			// Logic update: Accept data if either teams OR fixtures are found
			const hasTeams =
				leagueData && leagueData.teams && leagueData.teams.length > 0;
			const hasFixtures =
				leagueData && leagueData.fixtures && leagueData.fixtures.length > 0;

			if (leagueData && (hasTeams || hasFixtures)) {
				leagueData.leagueType = leagueType;
				await this.cache.set(leagueType, leagueData);
				this.sendDebugInfo(
					"Sending LEAGUE_DATA for " +
						leagueType +
						" (Teams: " +
						hasTeams +
						", Fixtures: " +
						hasFixtures +
						")"
				);
				this.sendSocketNotification(
					"LEAGUE_DATA",
					this.resolveLogos(leagueData, config)
				);
			} else {
				throw new Error(
					`No ${leagueType} data (teams or fixtures) parsed from website`
				);
			}
		} catch (error) {
			this.sendDebugInfo("Error fetching " + leagueType, error.message);
			console.error(
				` MMM-SoccerStandings: Error fetching ${leagueType} data:`,
				error.message
			);

			// Fallback to cache
			const fallbackData = await this.cache.get(leagueType);
			if (fallbackData) {
				fallbackData.leagueType = leagueType;
				fallbackData.fromCache = true;
				fallbackData.cacheFallback = true;
				this.sendSocketNotification(
					"LEAGUE_DATA",
					this.resolveLogos(fallbackData, config)
				);
			}
		}
	},

	// Fetch webpage content
	async fetchWebPage(url) {
		try {
			const result = await requestManager.queueRequest({
				url: url,
				options: {
					method: "GET",
					headers: {
						"User-Agent":
							"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
						Accept:
							"text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
						"Accept-Language": "en-US,en;q=0.5",
						Connection: "keep-alive"
					}
				},
				timeout: 10000,
				priority: 1, // Normal priority
				moduleId: "MMM-SoccerStandings",
				deduplicate: true
			});

			if (!result.success) {
				throw new Error(`HTTP ${result.status}: Request failed`);
			}

			return result.data;
		} catch (error) {
			console.error(" MMM-SoccerStandings: Fetch error:", error.message);
			throw error;
		}
	},

	startCacheCleanup() {
		const cleanupInterval = 6 * 60 * 60 * 1000; // 6 hours
		setInterval(async () => {
			const deleted = await this.cache.cleanupExpired();
			if (deleted > 0) {
				console.log(
					` MMM-SoccerStandings: Automatic cache cleanup removed ${deleted} expired entries`
				);
			}
		}, cleanupInterval);

		if (this.config && this.config.debug) {
			console.log(
				" MMM-SoccerStandings: Cache cleanup scheduled every 6 hours"
			);
		}
	},

	// Clean up team name
	cleanTeamName(name) {
		return name
			.replace(/^\d+\s*/, "") // Remove leading position numbers
			.replace(/\s+/g, " ") // Normalize whitespace
			.trim();
	}
});
