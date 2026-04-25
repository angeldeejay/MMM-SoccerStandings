/* MagicMirror²
 * Module:  MMM-SoccerStandings
 *
 * Author: gitgitaway with assistance from Zencoder AI Assistant
 * MIT Licensed.
 *
 * This module displays API-first football standings and tournament views for the
 * active product baseline around UEFA Champions League, Colombian Primera A, and
 * FIFA World Cup 2026 via canonical competition payloads.
 */

// COMPETITION_KEYS are loaded via getScripts() below.

Module.register("MMM-SoccerStandings", {
	// Load external scripts
	getScripts() {
		return [
			"moment.js",
			"moment-timezone.js",
			`modules/${this.name}/constants/competition-keys.js`,
			`modules/${this.name}/competition-provider.js`,
			`modules/${this.name}/providers/competition-provider-espn-service.js`,
			`modules/${this.name}/canonical-view-adapter.js`
		];
	},

	// Override getHeader to dynamically update the title
	getHeader() {
		if (
			typeof this.config.header === "undefined" ||
			this.config.header === null ||
			this.config.header === false
		) {
			// MagicMirror 2.34 renders boolean false as visible text in the header.
			return "";
		}

		return this.data.header || "League Standings";
	},

	// Default module config
	defaults: {
		updateInterval: 30 * 60 * 1000, // How often to refresh (ms) – default: 30 min
		retryDelay: 15000, // Delay between retry attempts after an error (ms)
		maxRetries: 3, // Stop retrying after this many failures
		animationSpeed: 0, // DOM update animation speed (ms)
		fadeSpeed: 0, // Fade animation speed (ms)
		colored: true, // Color rows by standing (top/UEFA/relegation)
		maxTeams: 36, // 0 = show all teams
		highlightTeams: ["Celtic", "Hearts"], // Emphasize teams by exact name
		// ===== League Selection =====
		// Use selectedLeagues to choose leagues by espn_service slug.
		// Example: selectedLeagues: ["uefa.champions", "fifa.world"]
		selectedLeagues: ["uefa.champions"],

		autoFocusRelevantSubTab: true, // Automatically focus on the sub-tab with live or upcoming matches

		// ===== Display Options =====
		showPosition: true, // Show table position
		showTeamLogos: true, // Show team logos
		showPlayedGames: true, // Show games played
		showWon: true, // Show wins
		showDrawn: true, // Show draws
		showLost: true, // Show losses
		showGoalsFor: true, // Show goals for
		showGoalsAgainst: true, // Show goals against
		showGoalDifference: true, // Show goal difference
		showPoints: true, // Show points
		showForm: true, // Show recent form tokens (W/D/L)
		formMaxGames: 5, // Max number of form games to display
		enhancedIndicatorShapes: true, // true = shape differentiation on form tokens (circle/square/triangle); false = no background, colored text only (W=green, D=grey, L=red)
		highlightedColor: "rgba(255, 255, 255, 0.1)", // Color for highlighted teams

		// ===== UX Options (Phase 4) =====
		tableDensity: "normal", // Table row density: "compact", "normal", "comfortable"
		fixtureDateFilter: null, // Filter fixtures by date range: null (show all), "today", "week", "month", or {start: "YYYY-MM-DD", end: "YYYY-MM-DD"}
		maxLeaguePastFixtures: null, // Optional cap for flat-league recent results after windowing
		maxLeagueUpcomingFixtures: null, // Optional cap for flat-league upcoming fixtures after windowing
		// ===== Theme Options (Phase 4) =====
		theme: "auto", // Color theme: "auto" (follows system), "light", "dark"
		customTeamColors: {}, // Custom colors for specific teams: {"Team Name": "#HEXCOLOR"}

		// ===== Auto-cycling options =====
		autoCycle: false, // Enable auto-cycling between leagues
		cycleInterval: 15 * 1000, // Time to display each league (15 seconds)
		wcSubtabCycleInterval: 15 * 1000, // Time to display each WC sub-tab (groups/knockouts)
		autoCycleWcSubtabs: true, // Allow auto-cycling of World Cup sub-tabs

		// ===== League Headers =====
		// Optional user overrides only; active runtime names come from the API catalog.
		leagueHeaders: {},

		// Theme overrides
		darkMode: null, // null=auto, true=force dark, false=force light
		fontColorOverride: "#FFFFFF", // Set to "null" for your existing css colour scheme or override all font colors "#FFFFFF" to force white text
		opacityOverride: null, // null=auto,  set to  1.0 to force full opacity

		// Debug
		debug: false, // Set to true to enable console logging
		provider: "espn_service", // Default product provider for the active canonical runtime path
		espnSoccerApiBaseUrl: "http://localhost:28000", // Preferred ESPN service base URL for canonical requests
		espnSoccerApiTimeout: 8000, // Preferred ESPN service timeout for canonical requests
		providerSettings: {
			espn_service: {
				baseUrl: "http://localhost:28000", // Compatibility fallback; prefer espnSoccerApiBaseUrl
				timeoutMs: 8000 // Compatibility fallback; prefer espnSoccerApiTimeout
			}
		},
		dateTimeOverride: null, // Override system date/time for testing. Use ISO date format (e.g., "2026-01-15" or "2026-01-15T14:30:00Z"). null = use system date

		// Cache controls
		clearCacheButton: true,
		clearCacheOnStart: false // Set to true to force-clear ALL caches (disk, fixture, logo) on every module start - useful for development and troubleshooting
	},

	// Required version of MagicMirror
	requiresVersion: "2.1.0",

	// Module startup
	start() {
		Log.info(`Starting module: ${this.name}`);
		this.competitionProvider = null;
		if (typeof CompetitionProvider !== "undefined") {
			this.competitionProvider = CompetitionProvider.initialize(
				this.config.provider || "espn_service",
				this
			);
		}

		// ===== INITIALIZE LEAGUE SYSTEM =====
		// Determine which leagues are enabled based on config
		this.determineEnabledLeagues();

		// Track loaded state per enabled league while canonical payloads populate the UI.
		this.loaded = {};

		// Populate load tracking for each enabled league
		this.enabledLeagueCodes.forEach((leagueCode) => {
			this.loaded[leagueCode] = false;
		});
		this.canonicalData = {};

		this.error = null;
		this.retryCount = 0;

		// Initialize screen reader announcement system (A11Y-04)
		this.lastAnnouncement = Date.now();
		this.announcementThrottle = 3000; // 3 seconds minimum between announcements
		this.createAriaLiveRegion();

		// Initialize lazy image loading system (PERF-08)
		this.setupLazyLoading();

		// Initialize offline mode detection (UX-07)
		this.isOnline = navigator.onLine;
		this.setupOfflineDetection();

		// Set current league to first enabled league
		this.currentLeague =
			this.enabledLeagueCodes.length > 0
				? this.enabledLeagueCodes[0]
				: this.resolveCompetitionValue(
						COMPETITION_KEYS.UEFA_CHAMPIONS,
						"espn_service"
					) ||
					this.normalizeLeagueCode(this.defaults.selectedLeagues[0]);

		this.currentSubTab = this.getDefaultCompetitionSubTab(this.currentLeague);

		this.isScrolling = false;
		this.isContentHidden = false; // Add state for content visibility
		this._pinned = false; // when true, temporarily lock view and pause auto-cycling
		this._countdownEl = null; // header countdown element
		this._countdownTimer = null;

		if (this.config.debug) {
			Log.info(
				` MMM-SoccerStandings: Enabled leagues: ${JSON.stringify(this.enabledLeagueCodes)}`
			);
			Log.info(` MMM-SoccerStandings: Current league: ${this.currentLeague}`);
		}

		// Optionally clear cache once at startup
		if (this.config.clearCacheOnStart === true) {
			if (this.config.debug)
				Log.info(" MMM-SoccerStandings: Clearing cache on start");
			this.sendSocketNotification("CACHE_CLEAR_ALL");
		}

		// Send initial request for data for all enabled leagues
		this.requestAllLeagueData();

		// Set up periodic updates
		this.scheduleUpdate();

		// Set up auto-cycling if enabled
		if (this.config.autoCycle) {
			this.scheduleCycling();
			this.scheduleWorldCupSubtabCycling();
		}

		if (this.config.debug) {
			Log.info(
				` MMM-SoccerStandings: Module started with config: ${JSON.stringify(this.config)}`
			);
		}
	},

	/**
	 * Gets the current date, with optional override for testing.
	 * Validates dateTimeOverride to prevent invalid date exploits.
	 * @returns {Date} The current or overridden date
	 */
	getCurrentDate() {
		if (this.config.dateTimeOverride) {
			const validated = this.validateDateTimeOverride(
				this.config.dateTimeOverride
			);
			if (validated) {
				if (this.config.debug) {
					Log.info(
						` MMM-SoccerStandings: Using validated date override: ${this.config.dateTimeOverride} -> ${validated.toISOString()}`
					);
				}
				return validated;
			}
		}
		return new Date();
	},

	/**
	 * Security helper: Validates dateTimeOverride input to prevent invalid dates and exploits.
	 * @param {string} dateString - The ISO date string to validate
	 * @returns {Date|null} The validated Date object or null if invalid
	 */
	validateDateTimeOverride(dateString) {
		if (!dateString || typeof dateString !== "string") {
			if (this.config.debug) {
				Log.warn(
					` MMM-SoccerStandings: Invalid dateTimeOverride type: ${typeof dateString}`
				);
			}
			return null;
		}

		const override = new Date(dateString);

		if (isNaN(override.getTime())) {
			Log.warn(
				` MMM-SoccerStandings: Invalid dateTimeOverride format: ${dateString}`
			);
			return null;
		}

		const year = override.getFullYear();
		if (year < 1900 || year > 2100) {
			Log.warn(
				` MMM-SoccerStandings: dateTimeOverride year out of range (1900-2100): ${dateString} (year: ${year})`
			);
			return null;
		}

		return override;
	},

	getCurrentDateString() {
		return this.getCurrentDate().toLocaleDateString("en-CA");
	},

	// Standardize team names for comparisons using provider-native names only.
	normalizeTeamName(str) {
		if (!str) return "";

		// 1. Remove diacritics
		let result = str.replace(/ß/g, "ss").replace(/ø/g, "o").replace(/æ/g, "ae");
		result = result.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

		// 2. Lowercase and strip common tournament suffixes/words
		return result
			.toLowerCase()
			.replace(/\([^)]*\)/g, "") // Strip anything in parentheses like (Host) or (Title Holder)
			.replace(/\b(and|the|of|rep|republic)\b/g, "") // Strip common words
			.replace(/&/g, " ")
			.replace(/[-]/g, " ") // Replace hyphens with spaces
			.replace(/\s+/g, " ")
			.trim()
			.replace(/[.,]/g, "");
	},

	// Returns true if the given team name matches any entry in config.highlightTeams.
	// Uses normalized substring matching so "Arsenal" matches "Arsenal FC" and vice versa.
	_isHighlightedTeam(name) {
		if (
			!name ||
			!this.config.highlightTeams ||
			!this.config.highlightTeams.length
		)
			return false;
		const norm = this.normalizeTeamName(name);
		return this.config.highlightTeams.some((ht) => {
			const htNorm = this.normalizeTeamName(ht);
			return norm.includes(htNorm) || htNorm.includes(norm);
		});
	},

	// ===== NEW: Determine which leagues are enabled =====
	// Uses selectedLeagues as the source of truth for league visibility.
	// Populates this.enabledLeagueCodes array with league codes to fetch
	determineEnabledLeagues() {
		this.enabledLeagueCodes = [];

		// PRIORITY 1: Use selectedLeagues if provided and not empty
		if (
			this.config.selectedLeagues &&
			Array.isArray(this.config.selectedLeagues) &&
			this.config.selectedLeagues.length > 0
		) {
			// Filter and validate league codes from selectedLeagues
			this.config.selectedLeagues.forEach((leagueCode) => {
				const normalizedCode = this.normalizeLeagueCode(leagueCode);
				const resolvedLeagueCode =
					this.resolveCompetitionValue(normalizedCode) ||
					this.resolveCompetitionKey(normalizedCode);
				if (
					resolvedLeagueCode &&
					this.isRecognizedCompetitionSelection(normalizedCode) &&
					!this.enabledLeagueCodes.includes(resolvedLeagueCode)
				) {
					this.enabledLeagueCodes.push(resolvedLeagueCode);
				} else if (normalizedCode && this.config.debug) {
					Log.warn(
						` MMM-SoccerStandings: Ignoring unsupported selectedLeagues entry "${normalizedCode}". Use espn_service slugs or active competition keys.`
					);
				}
			});

			if (this.config.debug) {
				Log.info(
					` MMM-SoccerStandings: Using selectedLeagues config: ${JSON.stringify(this.enabledLeagueCodes)}`
				);
			}
		}

		// Fallback: If after all logic no leagues are enabled, default to uefa.champions
		if (this.enabledLeagueCodes.length === 0) {
			this.enabledLeagueCodes = [
				this.resolveCompetitionValue(
					COMPETITION_KEYS.UEFA_CHAMPIONS,
					"espn_service"
				) || this.normalizeLeagueCode(this.defaults.selectedLeagues[0])
			];
			if (this.config.debug) {
				Log.warn(
					" MMM-SoccerStandings: No leagues enabled after filtering, defaulting to uefa.champions"
				);
			}
		}

		// Ensure currentLeague is valid and present in enabledLeagueCodes
		// If currentLeague is not set or not enabled, set it to the first enabled league
		if (
			!this.currentLeague ||
			!this.enabledLeagueCodes.includes(this.currentLeague)
		) {
			if (this.enabledLeagueCodes.length > 0) {
				this.currentLeague = this.enabledLeagueCodes[0];
			} else {
				this.currentLeague =
					this.resolveCompetitionValue(
						COMPETITION_KEYS.UEFA_CHAMPIONS,
						"espn_service"
					) ||
					this.normalizeLeagueCode(this.defaults.selectedLeagues[0]);
			}
		}
	},

	// Normalize configured competition identifiers.
	// The active path accepts canonical keys and provider slugs directly, while the
	// slug remains the live identifier used by the frontend shell.
	normalizeLeagueCode(code) {
		if (!code || typeof code !== "string") return null;
		const normalized = code.trim();
		if (!normalized) return null;
		return normalized;
	},

	resolveCompetitionKey(
		competitionValue,
		providerId = DEFAULT_COMPETITION_PROVIDER || "espn_service"
	) {
		const normalizedValue = this.normalizeLeagueCode(competitionValue);
		if (!normalizedValue) {
			return null;
		}

		if (typeof getCompetitionKey !== "function") {
			return normalizedValue;
		}

		return getCompetitionKey(normalizedValue, providerId) || normalizedValue;
	},

	resolveCompetitionValue(
		competitionValue,
		providerId = DEFAULT_COMPETITION_PROVIDER || "espn_service"
	) {
		const normalizedValue = this.normalizeLeagueCode(competitionValue);
		if (!normalizedValue) {
			return null;
		}

		if (
			typeof getCompetitionValue !== "function" ||
			typeof isCompetitionKey !== "function"
		) {
			return normalizedValue.includes(".") ? normalizedValue.toLowerCase() : null;
		}

		const competitionKey = this.resolveCompetitionKey(normalizedValue, providerId);
		if (isCompetitionKey(competitionKey)) {
			return getCompetitionValue(competitionKey, providerId);
		}

		return normalizedValue.includes(".") ? normalizedValue.toLowerCase() : null;
	},

	isRecognizedCompetitionSelection(
		competitionValue,
		providerId = DEFAULT_COMPETITION_PROVIDER || "espn_service"
	) {
		const normalizedValue = this.normalizeLeagueCode(competitionValue);
		if (!normalizedValue) {
			return false;
		}

		const competitionKey = this.resolveCompetitionKey(normalizedValue, providerId);
		if (
			typeof isCompetitionKey === "function" &&
			isCompetitionKey(competitionKey)
		) {
			return true;
		}

		return Boolean(this.resolveCompetitionValue(normalizedValue, providerId));
	},

	getCanonicalDataKey(leagueCode) {
		return this.resolveCompetitionKey(leagueCode);
	},

	getLeagueMapKey(leagueCode) {
		return this.resolveCompetitionKey(leagueCode);
	},

	getCanonicalCompetitionPayload(leagueCode) {
		const canonicalDataKey = this.getCanonicalDataKey(leagueCode);
		return canonicalDataKey && this.canonicalData
			? this.canonicalData[canonicalDataKey] || null
			: null;
	},

	humanizeLeagueIdentifier(leagueCode) {
		const rawValue =
			this.getResolvedLeagueSlug(leagueCode) ||
			this.normalizeLeagueCode(leagueCode) ||
			(typeof leagueCode === "string" ? leagueCode.trim() : "");
		if (!rawValue) {
			return "";
		}

		return rawValue
			.split(".")
			.filter(Boolean)
			.map((segment) =>
				segment
					.replace(/[_-]+/g, " ")
					.replace(/\b\w/g, (char) => char.toUpperCase())
			)
			.join(" ");
	},

	buildLeagueAbbreviation(leagueName) {
		if (typeof leagueName !== "string" || !leagueName.trim()) {
			return "";
		}

		const tokens = leagueName
			.trim()
			.split(/\s+/)
			.filter(Boolean);
		if (tokens.length === 1) {
			return tokens[0].slice(0, 3).toUpperCase();
		}

		const abbreviation = tokens
			.slice(0, 4)
			.map((token) => token.charAt(0).toUpperCase())
			.join("");
		return abbreviation || leagueName.slice(0, 3).toUpperCase();
	},

	getActiveCompetitionProvider() {
		if (this.competitionProvider) {
			return this.competitionProvider;
		}

		this.competitionProvider = CompetitionProvider.initialize(
			this.config.provider || "espn_service",
			this
		);
		return this.competitionProvider;
	},

	getLeagueUrl(leagueCode) {
		return this.getResolvedLeagueSlug(leagueCode);
	},

	getResolvedLeagueSlug(leagueCode) {
		return this.getActiveCompetitionProvider().resolveLeagueSlug(leagueCode);
	},

	isWorldCupLeague(leagueCode, urls = null) {
		return this.getActiveCompetitionProvider().isWorldCupCompetition(
			leagueCode,
			urls
		);
	},

	getPreferredWorldCupLeagueCode(codes = null) {
		return this.getActiveCompetitionProvider().getPreferredWorldCupLeagueCode(
			Array.isArray(codes) ? codes : this.enabledLeagueCodes
		);
	},

	isUEFATournamentLeague(leagueCode) {
		return this.getActiveCompetitionProvider().isUefaTournamentCompetition(
			leagueCode
		);
	},

	usesCompetitionSubTabs(leagueCode, urls = null) {
		return (
			this.isWorldCupLeague(leagueCode, urls) ||
			this.isUEFATournamentLeague(leagueCode, urls) ||
			this.shouldUseCanonicalFlatSlice(leagueCode, urls)
		);
	},

	usesTournamentView(leagueCode, urls = null) {
		return (
			this.isWorldCupLeague(leagueCode, urls) ||
			this.isUEFATournamentLeague(leagueCode, urls)
		);
	},

	getWorldCupGroupSubTabs() {
		return ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];
	},

	getWorldCupKnockoutSubTabs() {
		return ["Rd32", "Rd16", "QF", "SF", "TP", "Final"];
	},

	getUefaKnockoutSubTabs(leagueCode) {
		const competitionKey = this.resolveCompetitionKey(leagueCode, "espn_service");
		const stageOrder = ["Playoff", "Rd16", "QF", "SF", "Final"];

		return stageOrder.filter(
			(stageId) =>
				competitionKey !== COMPETITION_KEYS.UEFA_CHAMPIONS ||
				!["Playoff", "Rd16"].includes(stageId)
		);
	},

	getCompetitionSubTabs(leagueCode) {
		if (this.isWorldCupLeague(leagueCode)) {
			return [
				...this.getWorldCupGroupSubTabs(),
				...this.getWorldCupKnockoutSubTabs()
			];
		}

		if (this.isUEFATournamentLeague(leagueCode)) {
			return ["Table", ...this.getUefaKnockoutSubTabs(leagueCode)];
		}

		if (this.shouldUseCanonicalFlatSlice(leagueCode)) {
			return ["Table", "Fixtures"];
		}

		return [];
	},

	getCompetitionSubTabLabel(leagueCode, subTabId) {
		if (subTabId === "Table") {
			return this.translate("TABLE");
		}

		if (subTabId === "Fixtures") {
			return this.getFlatLeagueFixturesTabLabel();
		}

		if (this.isWorldCupLeague(leagueCode) && /^[A-L]$/.test(subTabId)) {
			return subTabId;
		}

		const labelMap = {
			Playoff: this.translate("PLAYOFF"),
			Rd32: this.translate("ROUND_OF_32"),
			Rd16: this.translate("ROUND_OF_16"),
			QF: this.translate("QUARTER_FINAL"),
			SF: this.translate("SEMI_FINAL"),
			TP: this.translate("THIRD_PLACE"),
			Final: this.translate("FINAL")
		};

		return labelMap[subTabId] || subTabId;
	},

	getCompetitionSubTabAriaLabel(leagueCode, subTabId) {
		if (this.isWorldCupLeague(leagueCode) && /^[A-L]$/.test(subTabId)) {
			return `Show Group ${subTabId} standings`;
		}

		const label = this.getCompetitionSubTabLabel(leagueCode, subTabId);
		if (subTabId === "Table" || subTabId === "Fixtures") {
			return `Show ${label}`;
		}

		return `Show ${label} fixtures`;
	},

	ensureCurrentSubTab(leagueCode) {
		const availableSubTabs = this.getCompetitionSubTabs(leagueCode);
		if (!availableSubTabs.length) {
			this.currentSubTab = null;
			return;
		}

		if (!availableSubTabs.includes(this.currentSubTab)) {
			this.currentSubTab = availableSubTabs[0];
		}
	},

	shouldShowLeagueButtons() {
		return Array.isArray(this.enabledLeagueCodes) && this.enabledLeagueCodes.length > 1;
	},

	getKnockoutFixturesForSubTab(currentData, subTab) {
		if (!currentData || !subTab) {
			return [];
		}

		const koKey = String(subTab).toLowerCase();
		const structuredKnockouts =
			currentData.knockouts && Array.isArray(currentData.knockouts[koKey])
				? currentData.knockouts[koKey]
				: [];
		if (structuredKnockouts.length > 0) {
			return structuredKnockouts;
		}

		return Array.isArray(currentData.fixtures)
			? currentData.fixtures.filter((fixture) => fixture && fixture.stage === subTab)
			: [];
	},

	getDefaultCompetitionSubTab(leagueCode) {
		const subTabs = this.getCompetitionSubTabs(leagueCode);
		return subTabs.length > 0 ? subTabs[0] : null;
	},

	// ===== NEW: Request data for all enabled leagues (dynamic) =====
	// Iterates through enabledLeagueCodes and fetches data for each league
	// Replaces the old hardcoded showXXX conditionals
	requestAllLeagueData() {
		if (!this.enabledLeagueCodes || this.enabledLeagueCodes.length === 0) {
			if (this.config.debug) {
				Log.warn(" MMM-SoccerStandings: No leagues configured to fetch");
			}
			return;
		}

		const espnApiConfig = this.getEspnServiceRequestConfig();

		// Iterate through each enabled league code and request its data with staggering to avoid spikes
		this.enabledLeagueCodes.forEach((leagueCode, index) => {
			const slug = this.getLeagueUrl(leagueCode);

			if (!slug) {
				Log.error(
					` MMM-SoccerStandings: Could not resolve ESPN slug for league code: ${leagueCode}`
				);
				return; // Skip this league if no URL found
			}

			// Stagger requests by 500ms to prevent network/CPU spikes
			setTimeout(() => {
				if (this.config.debug) {
					Log.info(
						` MMM-SoccerStandings: Requesting canonical data for ${leagueCode} from ${slug}`
					);
				}

				if (this.shouldRequestCanonicalCompetitionPayload(leagueCode, slug)) {
					this.sendSocketNotification("GET_COMPETITION_PAYLOAD", {
						leagueType: leagueCode,
						slug,
						debug: this.config.debug,
						provider: this.config.provider,
						espnSoccerApiBaseUrl: espnApiConfig.baseUrl,
						espnSoccerApiTimeout: espnApiConfig.timeoutMs,
						surfaces: {
							standings: true,
							fixtures: true
						},
						requestMeta: {
							requestId: `${leagueCode}-${Date.now()}`,
							forceRefresh: false
						}
					});
					return;
				}

				if (this.config.debug) {
					Log.warn(
						` MMM-SoccerStandings: Skipping unsupported non-canonical league "${leagueCode}" in API-first mode.`
					);
				}
			}, index * 500);
		});
	},

	/**
	 * Resolve the API endpoint configuration sent to the backend helper.
	 * Top-level options are the preferred public config surface; nested
	 * providerSettings remain as compatibility fallback while old configs fade
	 * out.
	 *
	 * @returns {{ baseUrl: string, timeoutMs: number }}
	 */
	getEspnServiceRequestConfig() {
		const providerSettings =
			this.config &&
			this.config.providerSettings &&
			this.config.providerSettings.espn_service
				? this.config.providerSettings.espn_service
				: {};
		const baseUrl =
			typeof this.config.espnSoccerApiBaseUrl === "string" &&
			this.config.espnSoccerApiBaseUrl.trim()
				? this.config.espnSoccerApiBaseUrl.trim()
				: typeof providerSettings.baseUrl === "string" &&
					providerSettings.baseUrl.trim()
					? providerSettings.baseUrl.trim()
					: "http://localhost:28000";
		const timeoutMs =
			Number.isFinite(this.config.espnSoccerApiTimeout) &&
			this.config.espnSoccerApiTimeout > 0
				? Number(this.config.espnSoccerApiTimeout)
				: Number.isFinite(providerSettings.timeoutMs) &&
					providerSettings.timeoutMs > 0
					? Number(providerSettings.timeoutMs)
					: 8000;

		return {
			baseUrl: baseUrl.replace(/\/+$/, ""),
			timeoutMs
		};
	},

	/**
	 * Security helper: Creates a FontAwesome icon element safely without innerHTML.
	 * Prevents XSS vulnerabilities by using DOM manipulation instead of innerHTML.
	 * @param {string} iconClass - The FontAwesome class (e.g., 'fas fa-sync-alt')
	 * @returns {HTMLElement} The icon element
	 */
	createIcon(iconClass) {
		const icon = document.createElement("i");
		icon.className = iconClass;
		return icon;
	},

	/**
	 * Accessibility helper: Creates a table header cell with proper ARIA attributes.
	 * @param {string} text - The header text
	 * @param {string} className - The CSS class name
	 * @returns {HTMLElement} The th element with ARIA attributes
	 */
	createTableHeader(text, className) {
		const th = document.createElement("th");
		th.textContent = text;
		th.className = className;
		th.setAttribute("role", "columnheader");
		th.setAttribute("aria-sort", "none");
		return th;
	},

	/**
	 * Accessibility helper: Creates a table cell with proper ARIA attributes.
	 * @param {string} content - The cell content (optional)
	 * @param {string} className - The CSS class name (optional)
	 * @returns {HTMLElement} The td element with ARIA attributes
	 */
	createTableCell(content = "", className = "") {
		const td = document.createElement("td");
		if (content) td.textContent = content;
		if (className) td.className = className;
		td.setAttribute("role", "cell");
		return td;
	},

	/**
	 * Accessibility helper: Adds keyboard navigation to an interactive element.
	 * Makes the element focusable and responds to Enter/Space keys like a button.
	 * @param {HTMLElement} element - The element to make keyboard accessible
	 * @param {Function} callback - The function to call when activated
	 */
	addKeyboardNavigation(element, callback) {
		if (!element) return;

		element.setAttribute("tabindex", "0");

		element.addEventListener("keydown", (e) => {
			if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
				e.preventDefault();
				if (callback) callback(e);
			}
		});
	},

	/**
	 * A11Y-08: Save the current keyboard focus state before a DOM update.
	 * Captures the focused team name and element class so focus can be restored
	 * after MagicMirror replaces the DOM via updateDom().
	 */
	saveFocusState() {
		const active = document.activeElement;
		if (!active) {
			this._savedFocusTeam = null;
			this._savedFocusClass = null;
			return;
		}
		const teamRow = active.closest("[data-team-name]");
		this._savedFocusTeam = teamRow
			? teamRow.getAttribute("data-team-name")
			: null;
		this._savedFocusClass = active.className || null;
		if (this.config.debug) {
			Log.info(
				`[A11Y-08] Saved focus state: team="${this._savedFocusTeam}" class="${this._savedFocusClass}"`
			);
		}
	},

	/**
	 * A11Y-08: Restore keyboard focus after a DOM update.
	 * Attempts to re-focus the element matching the previously saved team and class.
	 * Falls back to the module wrapper if a precise match is not found.
	 */
	restoreFocusState() {
		if (!this._savedFocusTeam) return;

		const wrapper = document.getElementById(`mtlt-${this.identifier}`);
		if (!wrapper) return;

		const teamRow = wrapper.querySelector(
			`[data-team-name="${CSS.escape(this._savedFocusTeam)}"]`
		);
		if (teamRow) {
			let target = null;
			if (this._savedFocusClass) {
				target = teamRow.querySelector(
					`.${this._savedFocusClass.trim().split(/\s+/)[0]}`
				);
			}
			const focusEl = target || teamRow;
			if (focusEl.getAttribute("tabindex") === null) {
				focusEl.setAttribute("tabindex", "-1");
			}
			focusEl.focus({ preventScroll: true });
			this.announceToScreenReader(
				`Table updated. Focus restored to ${this._savedFocusTeam}`,
				true
			);
			if (this.config.debug) {
				Log.info(`[A11Y-08] Restored focus to team="${this._savedFocusTeam}"`);
			}
		}

		this._savedFocusTeam = null;
		this._savedFocusClass = null;
	},

	/**
	 * Performance optimization: Setup Intersection Observer for lazy image loading (PERF-08).
	 * Provides better cross-browser consistency than native loading="lazy".
	 */
	setupLazyLoading() {
		// Check if Intersection Observer is supported
		if (!("IntersectionObserver" in window)) {
			// Fallback to immediate loading on older browsers
			this.imageObserver = null;
			if (this.config.debug) {
				Log.info(
					"[PERF-08] IntersectionObserver not supported - using immediate loading"
				);
			}
			return;
		}

		this.imageObserver = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (entry.isIntersecting) {
						const img = entry.target;
						const dataSrc = img.getAttribute("data-src");
						if (dataSrc) {
							img.src = dataSrc;
							img.removeAttribute("data-src");
							this.imageObserver.unobserve(img);

							if (this.config.debug) {
								Log.info(
									`[PERF-08] Lazy loaded image: ${dataSrc.substring(dataSrc.lastIndexOf("/") + 1)}`
								);
							}
						}
					}
				});
			},
			{
				rootMargin: "50px" // Start loading 50px before entering viewport
			}
		);

		if (this.config.debug) {
			Log.info("[PERF-08] Intersection Observer initialized for lazy loading");
		}
	},

	/**
	 * Performance helper: Setup lazy loading for an image element (PERF-08).
	 * @param {HTMLImageElement} img - The image element
	 * @param {string} src - The image source URL
	 */
	setupImageLazyLoading(img, src) {
		if (this.imageObserver) {
			// Use Intersection Observer
			img.setAttribute("data-src", src);
			// Use transparent SVG as placeholder
			img.src =
				'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"%3E%3C/svg%3E';
			img.loading = "lazy"; // Keep as fallback for browsers without IntersectionObserver
			this.imageObserver.observe(img);
		} else {
			// Fallback to immediate loading
			img.src = src;
			img.loading = "lazy";
		}
	},

	/**
	 * UX helper: Setup offline/online detection and status updates (UX-07).
	 */
	setupOfflineDetection() {
		window.addEventListener("online", () => this.handleOnlineStatus(true));
		window.addEventListener("offline", () => this.handleOnlineStatus(false));

		if (this.config.debug) {
			Log.info(
				`[UX-07] Offline detection initialized. Current status: ${this.isOnline ? "Online" : "Offline"}`
			);
		}
	},

	/**
	 * UX helper: Handle online/offline status changes (UX-07).
	 * @param {boolean} isOnline - Whether the browser is online
	 */
	handleOnlineStatus(isOnline) {
		const wasOffline = !this.isOnline;
		this.isOnline = isOnline;

		if (!isOnline) {
			this.announceToScreenReader(
				"Internet connection lost - showing cached data",
				true
			);
			if (this.config.debug) {
				Log.warn("[UX-07] Connection lost - entering offline mode");
			}
		} else if (wasOffline) {
			this.announceToScreenReader(
				"Internet connection restored - updating data",
				true
			);
			if (this.config.debug) {
				Log.info("[UX-07] Connection restored - updating data");
			}
			// Trigger data refresh
			this.requestAllLeagueData();
		}

		this.updateDom();
	},

	/**
	 * UX helper: Create offline mode indicator element (UX-07).
	 * @returns {HTMLElement|null} The offline indicator or null if online
	 */
	createOfflineIndicator() {
		if (this.isOnline) return null;

		const offlineIndicator = document.createElement("div");
		offlineIndicator.className = "offline-indicator";
		offlineIndicator.setAttribute("role", "status");
		offlineIndicator.setAttribute("aria-live", "polite");

		const icon = this.createIcon("fas fa-wifi-slash");
		const text = document.createTextNode(" Offline Mode - Showing Cached Data");

		offlineIndicator.appendChild(icon);
		offlineIndicator.appendChild(text);

		return offlineIndicator;
	},

	// Utility: determine if a WC stage is complete based on available data
	isWorldCupStageComplete(stageId) {
		const data = this.getRenderLeagueData(this.getPreferredWorldCupLeagueCode());
		if (!data) return false;

		// For groups: consider complete if every group A-L exists and each team has played all group matches
		if (stageId === "GROUPS") {
			const groups = this.getWorldCupGroupSubTabs();
			if (!data.groups) return false;
			for (const g of groups) {
				const teams = data.groups[g];
				if (!Array.isArray(teams) || teams.length === 0) return false;
				// Heuristic: when standings are final in group tables, BBC usually includes a 'played' equal maximum.
				// We consider group complete if all teams have a non-null played and max played equals min played and is >= number of group opponents.
				const playedVals = teams.map((t) => Number(t.played || 0));
				const minP = Math.min(...playedVals);
				const maxP = Math.max(...playedVals);
				if (!(minP > 0 && minP === maxP)) return false;
			}
			return true;
		}

		// For knockouts: consider complete if knockouts[stage] exists and all fixtures have a non-empty final score with FT/AET/PEN
		const koKey = String(stageId || "").toLowerCase();
		const list = data.knockouts && data.knockouts[koKey];
		if (!Array.isArray(list) || list.length === 0) return false;
		return list.every((f) => {
			const s = (f.score || "").toUpperCase();
			return s && s !== "VS" && /(FT|AET|PEN)/.test(s);
		});
	},

	// Set up auto-cycling between leagues with smooth transitions
	scheduleCycling() {
		if (this._pinned) return; // respect pin state
		var self = this;

		// Clear any existing timer
		if (this.cycleTimer) {
			clearInterval(this.cycleTimer);
			this.cycleTimer = null;
		}

		// Cycle through the resolved active league list instead of rebuilding it on
		// each tick from raw config state.

		// Only set up cycling if we have more than one league
		if (this.enabledLeagueCodes && this.enabledLeagueCodes.length > 1) {
			// Create a cycling function that will be called at regular intervals
			const cycleFn = function () {
				if (self.config.debug) {
					Log.info(" MMM-SoccerStandings: Running cycle function");
				}

				// Find current and next league
				let currentIndex = self.enabledLeagueCodes.indexOf(self.currentLeague);
				if (currentIndex === -1) {
					// If current league not found in enabled leagues, reset to first league
					currentIndex = 0;
					self.currentLeague = self.enabledLeagueCodes[0];
				}

				let nextIndex = (currentIndex + 1) % self.enabledLeagueCodes.length;
				let nextLeague = self.enabledLeagueCodes[nextIndex];

				if (self.config.debug) {
					Log.info(
						` MMM-SoccerStandings: Cycling from ${self.currentLeague} to ${nextLeague}`
					);
				}

				// Update current league
				self.currentLeague = nextLeague;

				self.currentSubTab = self.getDefaultCompetitionSubTab(nextLeague);

				// Reconfigure WC subtab cycling if needed (when entering/leaving WC)
				self.scheduleWorldCupSubtabCycling();

				// Use MagicMirror's built-in animation for a reliable transition
				self.updateDom();
			};

			// Set up the interval to run continuously
			const interval = this.config.cycleInterval;
			this.cycleTimer = setInterval(cycleFn, interval);

			// Also align WC subtab cycling when entering/leaving WC league
			this.scheduleWorldCupSubtabCycling();

			if (this.config.debug) {
				Log.info(
					` MMM-SoccerStandings: Auto-cycling enabled with interval ${
						interval / 1000
					} seconds`
				);
			}
		} else if (this.config.debug) {
			Log.info(
				" MMM-SoccerStandings: Auto-cycling not enabled - need at least 2 leagues"
			);
		}
	},

	// Schedule the next update
	scheduleUpdate() {
		var self = this;

		// Clear any existing timer
		if (this.updateTimer) {
			clearTimeout(this.updateTimer);
		}

		// Schedule next update
		let nextUpdate = this.config.updateInterval;

		// Reduce refresh time for matches that are live or likely live based on
		// kickoff time and missing final state, even if provider status lags.
		let hasLiveGames = false;
		let mightHaveLiveGames = false;
		const nowMs = Date.now();
		const todayDateStr = (() => {
			const d = new Date();
			const mm = String(d.getMonth() + 1).padStart(2, "0");
			const dd = String(d.getDate()).padStart(2, "0");
			return `${d.getFullYear()}-${mm}-${dd}`;
		})();

		(this.enabledLeagueCodes || [])
			.map((leagueCode) => this.getRenderLeagueData(leagueCode))
			.forEach((data) => {
				if (data && data.fixtures && Array.isArray(data.fixtures)) {
					data.fixtures.forEach((f) => {
						if (f.live) {
							hasLiveGames = true;
						}
						// Today's fixture with kick-off passed but not marked finished - likely in play.
						const st = (f.status || "").toUpperCase();
						const finished = st === "FT" || st === "PEN" || st === "AET";
						if (
							f.date === todayDateStr &&
							!finished &&
							f.timestamp &&
							f.timestamp < nowMs
						) {
							mightHaveLiveGames = true;
						}
					});
				}
			});

		if (hasLiveGames || mightHaveLiveGames) {
			nextUpdate = 3 * 60 * 1000; // 3 minutes
			if (this.config.debug) {
				Log.info(
					` MMM-SoccerStandings: ${hasLiveGames ? "Live" : "Potential live"} games detected, increasing refresh rate to 3 minutes.`
				);
			}
		}

		this.updateTimer = setTimeout(function () {
			self.requestAllLeagueData();
			self.scheduleUpdate();
		}, nextUpdate);

		if (this.config.debug) {
			Log.info(
				` MMM-SoccerStandings: Next update scheduled in ${nextUpdate / 1000} seconds`
			);
		}
	},

	// Handle notifications from node_helper
	socketNotificationReceived(notification, payload) {
		if (this.config.debug) {
			Log.info(` MMM-SoccerStandings: Received notification: ${notification}`);
		}

		switch (notification) {
			case "COMPETITION_PAYLOAD":
				this.processCompetitionPayload(payload);
				break;
			case "FETCH_ERROR":
				this.processError(payload);
				break;
			case "DEBUG_INFO":
				Log.info(`[MTLT-BACKEND] ${payload.message}`, payload.data || "");
				break;
		}
	},

	shouldUseCanonicalFlatSlice(leagueCode) {
		return this.getActiveCompetitionProvider().isFlatCompetition(leagueCode);
	},

	shouldUseCanonicalGroupedSlice(leagueCode) {
		return this.getActiveCompetitionProvider().isGroupedCompetition(leagueCode);
	},

	shouldUseCanonicalCompetitionSlice(leagueCode, urls = null) {
		return (
			this.shouldUseCanonicalFlatSlice(leagueCode, urls) ||
			this.shouldUseCanonicalGroupedSlice(leagueCode, urls)
		);
	},

	shouldRequestCanonicalCompetitionPayload(leagueCode, urls = null) {
		return this.shouldUseCanonicalCompetitionSlice(leagueCode, urls);
	},

	processCompetitionPayload(payload) {
		const competitionCode =
			payload && payload.competition ? payload.competition.code : null;
		const competitionSlug =
			payload && payload.competition ? payload.competition.slug : null;
		const canonicalDataKey = this.getCanonicalDataKey(
			competitionCode || competitionSlug
		);
		const loadedKeys = new Set(
			[
				this.normalizeLeagueCode(competitionSlug),
				this.normalizeLeagueCode(competitionCode),
				this.normalizeLeagueCode(canonicalDataKey)
			].filter(Boolean)
		);
		if (!canonicalDataKey) return;

		const existing = this.canonicalData[canonicalDataKey];
		if (
			existing &&
			existing.generatedAt &&
			payload.generatedAt &&
			existing.generatedAt === payload.generatedAt
		) {
			return;
		}

		this.canonicalData[canonicalDataKey] = payload;
		loadedKeys.forEach((loadedKey) => {
			this.loaded[loadedKey] = true;
		});
		this.error = null;
		this.retryCount = 0;

		const leagueName = this.getLeagueDisplayName(competitionSlug || competitionCode);
		this.announceDataUpdate(leagueName);
		this.debouncedUpdateDom();
	},

	buildCanonicalStandingsViewModel(payload) {
		return CanonicalViewAdapter.buildStandingsViewModel(
			payload,
			this.currentLeague
		);
	},

	buildCanonicalGroupedStandingsViewModel(payload) {
		return CanonicalViewAdapter.buildGroupedStandingsViewModel(
			payload,
			this.currentLeague
		);
	},

	getRenderLeagueData(leagueCode) {
		const canonicalDataKey = this.getCanonicalDataKey(leagueCode);
		if (this.shouldUseCanonicalCompetitionSlice(leagueCode)) {
			const canonicalPayload = canonicalDataKey
				? this.canonicalData[canonicalDataKey]
				: null;
			if (!canonicalPayload || !canonicalPayload.standings) {
				return null;
			}

			if (canonicalPayload.standings.kind === "flat") {
				return this.buildCanonicalStandingsViewModel(canonicalPayload);
			}

			if (canonicalPayload.standings.kind === "grouped") {
				return this.buildCanonicalGroupedStandingsViewModel(canonicalPayload);
			}
		}

		return null;
	},

	getFixtureStateFlags(fix) {
		const status = (fix.status || "").toUpperCase();
		const todayDateStr = this.getCurrentDateString();
		const isFinished =
			status === "FT" ||
			status === "AET" ||
			status === "PEN" ||
			status === "PENS" ||
			status === "PST" ||
			status === "CANC" ||
			(!status && !fix.live && fix.date && fix.date < todayDateStr);
		const isLive = fix.live === true || /\d+'|HT|LIVE/i.test(status);
		const isUpcoming = !isLive && !isFinished;

		return { isFinished, isLive, isUpcoming };
	},

	getFixtureDateTimeValue(fix) {
		if (!fix || !fix.date) {
			return null;
		}

		const hasKickoffTime =
			typeof fix.time === "string" && /^\d{1,2}:\d{2}$/.test(fix.time.trim());
		const rawValue = hasKickoffTime ? `${fix.date}T${fix.time.trim()}:00` : fix.date;
		const parsed = new Date(rawValue);

		if (isNaN(parsed.getTime())) {
			return null;
		}

		return parsed;
	},

	getLeagueDataLastUpdatedValue(data) {
		if (!data || typeof data !== "object") {
			return null;
		}

		return (data.meta && data.meta.lastUpdated) || data.lastUpdated || null;
	},

	createLastUpdatedLabel(data, className = "last-updated xsmall dimmed") {
		const tsValue = this.getLeagueDataLastUpdatedValue(data);
		if (!tsValue) {
			return null;
		}

		const lastUpdated = document.createElement("span");
		lastUpdated.className = className;
		lastUpdated.textContent = `${this.translate("LAST_UPDATED")}: ${moment(tsValue).format("HH:mm")}`;
		return lastUpdated;
	},

	createSourceInfoElement(data) {
		if (!data) {
			return null;
		}

		const sourceContainer = document.createElement("div");
		sourceContainer.className = "footer-source-info";
		sourceContainer.style.flex = "1";
		sourceContainer.style.textAlign = "center";
		sourceContainer.style.margin = "0 10px";

		const sourceSpan = document.createElement("span");
		sourceSpan.className = "dimmed xsmall";
		sourceSpan.textContent = `${this.translate("SOURCE")}: ${data.source || this.translate("SOURCE_UNAVAILABLE")}`;
		sourceContainer.appendChild(sourceSpan);

		const updatedSpan = this.createLastUpdatedLabel(
			data,
			"dimmed xsmall last-updated"
		);
		if (updatedSpan) {
			sourceContainer.appendChild(document.createTextNode(" • "));
			sourceContainer.appendChild(updatedSpan);
		}

		return sourceContainer;
	},

	selectFlatLeagueFixtureWindow(fixtures, mode) {
		if (!Array.isArray(fixtures) || fixtures.length === 0) {
			return [];
		}

		const maxWindowSize = 12;
		const maxDayGap = 2;
		const datedFixtures = fixtures
			.map((fix, index) => ({
				fix,
				index,
				dateValue: this.getFixtureDateTimeValue(fix)
			}))
			.filter((entry) => entry.dateValue instanceof Date);

		if (datedFixtures.length === 0) {
			return fixtures.slice(0, maxWindowSize);
		}

		datedFixtures.sort((a, b) => {
			const delta = a.dateValue - b.dateValue;
			return mode === "upcoming" ? delta : -delta;
		});

		const anchor = datedFixtures[0].dateValue;
		const windowed = datedFixtures
			.filter((entry) => {
				const dayGap = Math.abs(entry.dateValue - anchor) / (1000 * 60 * 60 * 24);
				return dayGap <= maxDayGap;
			})
			.slice(0, maxWindowSize)
			.sort((a, b) => a.index - b.index)
			.map((entry) => entry.fix);

		if (this.config.debug) {
			Log.info(
				`[FLAT-FIXTURES] ${mode} window reduced ${fixtures.length} fixtures to ${windowed.length} around ${anchor.toISOString()}`
			);
		}

		return windowed;
	},

	getFlatLeagueFixturesTabLabel() {
		const localized = this.translate("SUBTAB_FIXTURES", { subTab: "" });
		return localized
			.replace(/^\s*[-:]\s*/, "")
			.replace(/\s*[-:]\s*$/, "")
			.trim();
	},

	getConfiguredFlatLeagueFixtureLimit(configKey) {
		const rawValue = this.config[configKey];
		if (rawValue == null || rawValue === "") {
			return null;
		}

		const limit = Number(rawValue);
		if (Number.isInteger(limit) && limit > 0) {
			return limit;
		}

		Log.warn(
			`[FLAT-FIXTURES] Invalid ${configKey} value "${rawValue}". Expected a positive integer.`
		);
		return null;
	},

	createFlatLeagueFixturesView(currentData) {
		const container = document.createElement("div");
		const fragment = document.createDocumentFragment();
		const fixtures = Array.isArray(currentData.fixtures)
			? currentData.fixtures.slice()
			: [];

		if (fixtures.length > 0) {
			const highlightedFixtures = fixtures.filter(
				(fix) =>
					this._isHighlightedTeam(fix.homeTeam) ||
					this._isHighlightedTeam(fix.awayTeam)
			);
			const sourceFixtures =
				highlightedFixtures.length > 0 ? highlightedFixtures : fixtures;

			if (this.config.debug && highlightedFixtures.length > 0) {
				Log.info(
					`[FLAT-FIXTURES] Highlight filter reduced fixture pool from ${fixtures.length} to ${highlightedFixtures.length}`
				);
			}

			const results = this.selectFlatLeagueFixtureWindow(
				sourceFixtures.filter((fix) => {
					const { isFinished, isLive } = this.getFixtureStateFlags(fix);
					return isFinished || isLive;
				}),
				"results"
			);
			const upcoming = this.selectFlatLeagueFixtureWindow(
				sourceFixtures.filter((fix) => {
					const { isUpcoming } = this.getFixtureStateFlags(fix);
					return isUpcoming;
				}),
				"upcoming"
			);
			const pastLimit = this.getConfiguredFlatLeagueFixtureLimit(
				"maxLeaguePastFixtures"
			);
			const upcomingLimit = this.getConfiguredFlatLeagueFixtureLimit(
				"maxLeagueUpcomingFixtures"
			);
			const visibleResults = pastLimit ? results.slice(-pastLimit) : results;
			const visibleUpcoming = upcomingLimit
				? upcoming.slice(0, upcomingLimit)
				: upcoming;

			const splitViewContainer = document.createElement("div");
			splitViewContainer.className = "uefa-split-view-container";
			if (visibleResults.length > 0 && visibleUpcoming.length > 0) {
				splitViewContainer.classList.add("dual-sections");
			} else if (visibleResults.length > 0) {
				splitViewContainer.classList.add("only-results");
			} else if (visibleUpcoming.length > 0) {
				splitViewContainer.classList.add("only-upcoming");
			}

			if (visibleResults.length > 0) {
				const resultsWrapper = document.createElement("div");
				resultsWrapper.className = "uefa-section-wrapper results-section";

				const resultsTitle = document.createElement("div");
				resultsTitle.className = "wc-title";
				resultsTitle.textContent = this.translate("RESULTS");
				resultsWrapper.appendChild(resultsTitle);

				const resultsScroll = document.createElement("div");
				resultsScroll.className = "uefa-section-scroll";
				resultsScroll.appendChild(
					this.createFixturesTable(visibleResults, false)
				);
				resultsWrapper.appendChild(resultsScroll);
				splitViewContainer.appendChild(resultsWrapper);
			}

			if (visibleUpcoming.length > 0) {
				const upcomingWrapper = document.createElement("div");
				upcomingWrapper.className = "uefa-section-wrapper future-section";

				const upcomingTitle = document.createElement("div");
				upcomingTitle.className = "wc-title";
				upcomingTitle.textContent = this.translate("UPCOMING_FIXTURES");
				upcomingWrapper.appendChild(upcomingTitle);

				const upcomingScroll = document.createElement("div");
				upcomingScroll.className = "uefa-section-scroll";
				upcomingScroll.appendChild(
					this.createFixturesTable(visibleUpcoming, false)
				);
				upcomingWrapper.appendChild(upcomingScroll);
				splitViewContainer.appendChild(upcomingWrapper);
			}

			if (visibleResults.length > 0 || visibleUpcoming.length > 0) {
				fragment.appendChild(splitViewContainer);
			}
		}

		container.appendChild(fragment);
		return container;
	},

	createFlatLeagueView(currentData) {
		const container = document.createElement("div");
		const fragment = document.createDocumentFragment();
		const activeSubTab = this.currentSubTab || "Table";

		if (activeSubTab === "Table" && currentData.teams && currentData.teams.length > 0) {
			fragment.appendChild(this.createTable(currentData, this.currentLeague));
		}

		if (activeSubTab === "Fixtures") {
			fragment.appendChild(this.createFlatLeagueFixturesView(currentData));
		}

		container.appendChild(fragment);
		return container;
	},

	// ===== NEW: Debounced DOM Update =====
	// Batches multiple updates occurring within a short window (e.g., 200ms)
	// to prevent redundant re-renders when multiple leagues update at once
	debouncedUpdateDom() {
		if (this.updateDomTimer) {
			clearTimeout(this.updateDomTimer);
		}

		this.saveFocusState();

		this.updateDomTimer = setTimeout(() => {
			this.updateDom();
			this.updateDomTimer = null;
			const restoreDelay = 150;
			setTimeout(() => this.restoreFocusState(), restoreDelay);
		}, 200);
	},

	// Process error from data fetch
	processError(error) {
		const errorMessage = error.userMessage || error.message || String(error);
		const errorCategory = error.category || "Unknown";
		const errorSuggestion = error.suggestion || "Please try again later";

		Log.error(` MMM-SoccerStandings: [${errorCategory}] ${errorMessage}`);

		if (this.config.debug && error.originalError) {
			Log.error(` MMM-SoccerStandings: Original error: ${error.originalError}`);
		}

		this.error = error;
		this.retryCount++;

		// Retry if we haven't exceeded max retries
		if (this.retryCount <= this.config.maxRetries) {
			var self = this;
			setTimeout(function () {
				if (self.config.debug) {
					Log.info(
						` MMM-SoccerStandings: Retrying data fetch (attempt ${self.retryCount})`
					);
				}
				self.requestAllLeagueData();
			}, this.config.retryDelay);
		} else {
			Log.error(
				` MMM-SoccerStandings: Max retries exceeded. ${errorSuggestion}`
			);
			this.updateDom();
		}
	},

	getLeagueInfo(leagueCode) {
		return this.getActiveCompetitionProvider().getCompetitionInfo(
			leagueCode,
			this.getCanonicalCompetitionPayload(leagueCode)
		);
	},

	getLeagueDisplayName(leagueCode) {
		const normalizedLeagueCode = this.normalizeLeagueCode(leagueCode);
		const mapKey = this.getLeagueMapKey(leagueCode);
		const info = this.getLeagueInfo(leagueCode);

		return (
			this.config.leagueHeaders[normalizedLeagueCode] ||
			this.config.leagueHeaders[mapKey] ||
			(info && info.name) ||
			this.humanizeLeagueIdentifier(leagueCode) ||
			normalizedLeagueCode
		);
	},

	// Get league abbreviation from league code
	getLeagueAbbreviation(leagueCode) {
		const info = this.getLeagueInfo(leagueCode);
		return (
			(info && info.abbreviation) ||
			this.buildLeagueAbbreviation(this.getLeagueDisplayName(leagueCode))
		);
	},

	// Handle league button clicks with smooth transitions
	handleLeagueButtonClick(event) {
		if (!event) return;

		if (this.config.debug) {
			Log.info(" MMM-SoccerStandings: League button clicked");
		}

		// Prevent default behavior to avoid any scrolling/jumping issues
		if (event.preventDefault) event.preventDefault();
		if (event.stopPropagation) event.stopPropagation();

		// Robust button detection:
		// 1. event.currentTarget is the element the listener was attached to (the button)
		// 2. Fallback to closest .league-btn for delegation support
		let button = event.currentTarget;

		// If currentTarget is null or not the button, use target and find the closest button
		if (
			!button ||
			(button.classList && !button.classList.contains("league-btn"))
		) {
			if (event.target && typeof event.target.closest === "function") {
				button = event.target.closest(".league-btn");
			}
		}

		// Final check: if we still don't have a valid button, return
		if (!button || typeof button.getAttribute !== "function") {
			if (this.config.debug) {
				Log.warn(
					" MMM-SoccerStandings: No valid league button found in click event"
				);
			}
			return;
		}

		// Get league code with multiple fallbacks for cross-browser compatibility
		const leagueCode =
			button.getAttribute("data-league") ||
			(button.dataset ? button.dataset.league : null);

		if (!leagueCode) {
			if (this.config.debug) {
				Log.warn(
					" MMM-SoccerStandings: Clicked element has no data-league attribute"
				);
			}
			return;
		}

		const league = this.normalizeLeagueCode(leagueCode);

		if (league) {
			if (this.config.debug) {
				Log.info(` MMM-SoccerStandings: Switching to league: ${league}`);
			}

			if (this.currentLeague !== league) {
				// Update current league
				this.currentLeague = league;

				// Reset sub-tab for the new league
				this.currentSubTab = this.getDefaultCompetitionSubTab(league);

				// Use MagicMirror's built-in animation for a reliable transition
				this.updateDom();

				// Reset auto-cycling timer if we're manually changing leagues
				if (this.config.autoCycle && this.cycleTimer) {
					this.scheduleCycling();
				}
				// Ensure WC sub-tab cycling is aligned with manual league change
				this.scheduleWorldCupSubtabCycling();
			}
		}
	},

	// Handle back to top button click
	handleBackToTopClick() {
		const root = document.getElementById(`mtlt-${this.identifier}`);
		// FIX: Handle both regular tables and UEFA split-view (which has multiple scroll containers)
		const tableContainer = root
			? root.querySelector(".league-body-scroll") ||
				root.querySelector(".league-content-container")
			: null;

		// For UEFA split-view, scroll all section containers to top
		const uefaScrollContainers = root
			? root.querySelectorAll(".uefa-section-scroll")
			: null;

		if (tableContainer) {
			// Regular table - single scroll container
			tableContainer.scrollTo({
				top: 0,
				behavior: "smooth"
			});
		} else if (uefaScrollContainers && uefaScrollContainers.length > 0) {
			// UEFA split-view - scroll all sections to top
			uefaScrollContainers.forEach((container) => {
				container.scrollTo({
					top: 0,
					behavior: "smooth"
				});
			});
		}

		// Update button visibility after scrolling
		setTimeout(() => {
			this.updateScrollButtons();
		}, 500);
	},

	// Update scroll buttons visibility based on scroll position (log only on state change)
	updateScrollButtons() {
		const root = document.getElementById(`mtlt-${this.identifier}`);
		// FIX: Also check for UEFA split-view scroll containers
		const tableContainer = root
			? root.querySelector(".league-body-scroll") ||
				root.querySelector(".league-content-container") ||
				root.querySelector(".uefa-section-scroll")
			: null;
		const backToTopControls = root
			? root.querySelector(".back-to-top-controls")
			: null;

		if (tableContainer && backToTopControls) {
			const scrollTop = tableContainer.scrollTop;
			const isScrolled = scrollTop > 30;

			// Footer is now always visible via CSS sticky behavior
			// We just update the internal isScrolling state for other components
			this.isScrolling = isScrolled;

			// Always ensure the visible class is present for internal consistency
			if (!backToTopControls.classList.contains("visible")) {
				backToTopControls.classList.add("visible");
			}
		} else {
			if (this.config.debug) {
				Log.warn(
					`[LeagueTable] Missing elements - root: ${!!root} tableContainer: ${!!tableContainer} backToTopControls: ${!!backToTopControls}`
				);
			}
		}
	},

	// Compute and set team name column width to longest name + 10px
	updateTeamNameColumnWidth() {
		const root = document.getElementById(`mtlt-${this.identifier}`);
		if (!root) return;
		const names = root.querySelectorAll(".team-cell .team-name");
		if (!names || names.length === 0) return;
		// Build hidden measurer with same font properties
		const sample = names[0];
		const cs = window.getComputedStyle(sample);
		const measurer = document.createElement("span");
		measurer.style.position = "absolute";
		measurer.style.visibility = "hidden";
		measurer.style.whiteSpace = "nowrap";
		measurer.style.left = "-9999px";
		measurer.style.top = "-9999px";
		measurer.style.fontFamily = cs.fontFamily;
		measurer.style.fontSize = cs.fontSize;
		measurer.style.fontWeight = cs.fontWeight;
		measurer.style.fontStyle = cs.fontStyle;
		document.body.appendChild(measurer);
		let max = 0;
		names.forEach((n) => {
			measurer.textContent = n.textContent || "";
			const w = measurer.offsetWidth;
			if (w > max) max = w;
		});
		measurer.remove();
		const width = Math.ceil(max + 10);
		root.style.setProperty("--team-name-width", `${width}px`);
	},

	// Helper: skip redundant renders if same league/subtab and no pending error/loading state
	/**
	 * Create hidden ARIA live region for screen reader announcements (A11Y-04)
	 */
	createAriaLiveRegion() {
		if (!this.ariaLiveRegion) {
			this.ariaLiveRegion = document.createElement("div");
			this.ariaLiveRegion.setAttribute("role", "status");
			this.ariaLiveRegion.setAttribute("aria-live", "polite");
			this.ariaLiveRegion.setAttribute("aria-atomic", "true");
			this.ariaLiveRegion.className = "sr-only"; // Visually hidden
			this.ariaLiveRegion.style.position = "absolute";
			this.ariaLiveRegion.style.left = "-10000px";
			this.ariaLiveRegion.style.width = "1px";
			this.ariaLiveRegion.style.height = "1px";
			this.ariaLiveRegion.style.overflow = "hidden";
			document.body.appendChild(this.ariaLiveRegion);
		}
	},

	/**
	 * Announce message to screen readers with throttling (A11Y-04)
	 * @param {string} message - Message to announce
	 * @param {boolean} force - Force announcement bypassing throttle
	 */
	announceToScreenReader(message, force = false) {
		if (!message) return;

		const now = Date.now();

		// Throttle announcements to prevent spam
		if (!force && now - this.lastAnnouncement < this.announcementThrottle) {
			if (this.config.debug) {
				Log.info(`[A11Y] Throttled announcement: ${message}`);
			}
			return;
		}

		this.lastAnnouncement = now;

		if (!this.ariaLiveRegion) {
			this.createAriaLiveRegion();
		}

		// Clear and set new message (forces screen reader to announce)
		this.ariaLiveRegion.textContent = "";
		setTimeout(() => {
			this.ariaLiveRegion.textContent = message;
			if (this.config.debug) {
				Log.info(`[A11Y] Screen reader announcement: ${message}`);
			}
		}, 100);
	},

	/**
	 * Announce league data update (A11Y-04)
	 */
	announceDataUpdate(leagueName) {
		const message = `League data updated for ${leagueName}`;
		this.announceToScreenReader(message);
	},

	/**
	 * Announce live match update (A11Y-04)
	 */
	announceLiveMatch(homeTeam, awayTeam, homeScore, awayScore, status) {
		const message = `Live match: ${homeTeam} ${homeScore} - ${awayScore} ${awayTeam}, ${status}`;
		this.announceToScreenReader(message);
	},

	/**
	 * Announce match finished (A11Y-04)
	 */
	announceMatchFinished(homeTeam, awayTeam, homeScore, awayScore) {
		const message = `Match finished: Final score ${homeTeam} ${homeScore} - ${awayScore} ${awayTeam}`;
		this.announceToScreenReader(message);
	},

	/**
	 * Filter fixtures based on date range configuration (UX-05)
	 * @param {Array} fixtures - Array of fixture objects
	 * @returns {Array} - Filtered fixtures
	 */
	filterFixturesByDate(fixtures) {
		if (!fixtures || !Array.isArray(fixtures) || fixtures.length === 0) {
			return fixtures;
		}

		const filter = this.config.fixtureDateFilter;

		// No filtering if filter is null/undefined
		if (!filter) {
			return fixtures;
		}

		const now = new Date();
		const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

		let startDate, endDate;

		// Handle preset filters
		if (typeof filter === "string") {
			switch (filter.toLowerCase()) {
				case "today":
					startDate = new Date(today);
					endDate = new Date(today);
					endDate.setDate(endDate.getDate() + 1); // Include all of today
					break;
				case "week":
					startDate = new Date(today);
					endDate = new Date(today);
					endDate.setDate(endDate.getDate() + 7);
					break;
				case "month":
					startDate = new Date(today);
					endDate = new Date(today);
					endDate.setMonth(endDate.getMonth() + 1);
					break;
				default:
					// Invalid filter string, return all
					if (this.config.debug) {
						Log.warn(
							`[FILTER] Invalid filter preset: ${filter}. Use "today", "week", or "month"`
						);
					}
					return fixtures;
			}
		}
		// Handle custom date range {start: "YYYY-MM-DD", end: "YYYY-MM-DD"}
		else if (typeof filter === "object" && filter.start && filter.end) {
			startDate = new Date(filter.start);
			endDate = new Date(filter.end);

			// Validate dates
			if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
				if (this.config.debug) {
					Log.warn(
						`[FILTER] Invalid custom date range: ${filter.start} to ${filter.end}`
					);
				}
				return fixtures;
			}
		} else {
			// Invalid filter format
			if (this.config.debug) {
				Log.warn(`[FILTER] Invalid filter format:`, filter);
			}
			return fixtures;
		}

		// Filter fixtures within date range
		const filtered = fixtures.filter((fix) => {
			if (!fix.date) return false; // Skip fixtures without dates

			const fixtureDate = new Date(fix.date);
			if (isNaN(fixtureDate.getTime())) return false; // Skip invalid dates

			return fixtureDate >= startDate && fixtureDate <= endDate;
		});

		if (this.config.debug) {
			Log.info(
				`[FILTER] Filtered ${fixtures.length} fixtures to ${filtered.length} (${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()})`
			);
		}

		return filtered;
	},

	// Pause all cycling timers
	_pauseCycling() {
		if (this.cycleTimer) {
			clearInterval(this.cycleTimer);
			this.cycleTimer = null;
		}
		if (this.wcSubtabTimer) {
			clearInterval(this.wcSubtabTimer);
			this.wcSubtabTimer = null;
		}
		if (this.wcInitialDelayTimer) {
			clearTimeout(this.wcInitialDelayTimer);
			this.wcInitialDelayTimer = null;
		}
		this._stopHeaderCountdown();
	},
	// Resume cycling timers if config allows
	_resumeCyclingIfNeeded() {
		if (this.isScrolling || this._pinned) return;
		if (this.config.autoCycle) {
			this.scheduleCycling();
			this.scheduleWorldCupSubtabCycling();
			this._startHeaderCountdown();
		}
	},
	// Attach scroll-based pause/resume to a container
	_attachScrollPause(tableContainer) {
		if (!tableContainer) return;
		let lastScrolling = this.isScrolling;
		tableContainer.addEventListener(
			"scroll",
			() => {
				const nowScrolling = tableContainer.scrollTop > 30;
				if (nowScrolling && !lastScrolling) {
					this.isScrolling = true;
					this._pauseCycling();
					lastScrolling = true;
				} else if (!nowScrolling && lastScrolling) {
					this.isScrolling = false;
					this._resumeCyclingIfNeeded();
					lastScrolling = false;
				}
			},
			{ passive: true }
		);
	},

	// Generate the DOM content
	getDom() {
		var wrapper = document.createElement("div");
		wrapper.className = "soccer-standings";
		wrapper.id = `mtlt-${this.identifier}`;
		wrapper.setAttribute("data-league", this.currentLeague);

		// Apply table density class (UX-04)
		if (
			this.config.tableDensity &&
			["compact", "normal", "comfortable"].includes(this.config.tableDensity)
		) {
			wrapper.classList.add(`density-${this.config.tableDensity}`);
		}

		// Apply theme class (DES-02)
		if (
			this.config.theme &&
			["light", "dark", "auto"].includes(this.config.theme)
		) {
			wrapper.classList.add(`theme-${this.config.theme}`);
		}
		if (this.isContentHidden) {
			wrapper.classList.add("content-hidden");
		}

		// Add offline mode indicator if offline (UX-07)
		const offlineIndicator = this.createOfflineIndicator();
		if (offlineIndicator) {
			wrapper.appendChild(offlineIndicator);
		}

		const currentData = this.getRenderLeagueData(this.currentLeague);

		// If content is hidden, return wrapper with toggle icon and source in footer
		if (this.isContentHidden) {
			const hiddenWrapper = document.createElement("div");
			hiddenWrapper.className = "soccer-standings content-hidden";

			const footer = document.createElement("div");
			footer.className = "back-to-top-controls visible"; // Always visible when hidden
			footer.style.display = "flex";
			footer.style.justifyContent = "space-between";
			footer.style.alignItems = "center";
			footer.style.width = "100%";
			footer.style.boxSizing = "border-box";

			// Left: Toggle icon
			const toggleIcon = this._createToggleIcon();
			footer.appendChild(toggleIcon);

			// Center: Source info
			if (currentData) {
				const sourceContainer = this.createSourceInfoElement(currentData);
				if (sourceContainer) {
					footer.appendChild(sourceContainer);
				}
			}

			// Right: Spacer to keep source centered
			const spacer = document.createElement("div");
			spacer.style.width = "40px"; // Roughly the width of the toggle icon
			footer.appendChild(spacer);

			hiddenWrapper.appendChild(footer);
			return hiddenWrapper;
		}

		// Apply league-specific mode classes for selective CSS styling
		if (this.isWorldCupLeague(this.currentLeague)) {
			wrapper.classList.add("league-mode-wc");
		} else if (this.isUEFATournamentLeague(this.currentLeague)) {
			wrapper.classList.add("league-mode-uefa");
		} else {
			wrapper.classList.add("league-mode-national");
		}

		const wrapperFragment = document.createDocumentFragment();

		this._applyThemeOverrides();

		// Create header with league buttons
		var headerContainer = document.createElement("div");
		headerContainer.className = "league-header-container";

		// Create league title
		var leagueTitle = document.createElement("div");
		leagueTitle.className = "league-title";

		let baseTitle = this.getLeagueDisplayName(this.currentLeague);
		if (this.isWorldCupLeague(this.currentLeague) && this.currentSubTab) {
			const sub = this.currentSubTab;
			const stageMap = {
				Rd32: this.translate("ROUND_OF_32"),
				Rd16: this.translate("ROUND_OF_16"),
				QF: this.translate("QUARTER_FINAL"),
				SF: this.translate("SEMI_FINAL"),
				TP: this.translate("THIRD_PLACE"),
				Final: this.translate("FINAL")
			};
			if (/^[A-L]$/.test(sub)) {
				baseTitle += ` • ${this.translate("GROUP")} ${sub}`;
			} else if (stageMap[sub]) {
				baseTitle += ` • ${stageMap[sub]}`;
			}
		}
		leagueTitle.textContent = baseTitle;

		headerContainer.appendChild(leagueTitle);

		// Add meta info (Last Updated and Refresh button)
		const metaInfo = document.createElement("div");
		metaInfo.className = "league-meta-info";

		if (currentData) {
			const lastUpdated = this.createLastUpdatedLabel(currentData);
			if (lastUpdated) {
				metaInfo.appendChild(lastUpdated);
			}
		}

		// Add Enhanced Stale Data warning with timestamps (UX-03)
		if (currentData && (currentData.cacheFallback || currentData.incomplete)) {
			const staleWarning = document.createElement("span");
			staleWarning.className = "stale-warning xsmall";
			staleWarning.style.marginLeft = "8px";
			staleWarning.style.fontWeight = "bold";
			staleWarning.style.padding = "2px 8px";
			staleWarning.style.borderRadius = "3px";

			// Calculate age of data (UX-03)
			let dataAge = 0;
			let ageColor = "#ffa500"; // Default orange
			let ageSeverity = "medium";

			if (currentData.meta && currentData.meta.lastUpdated) {
				const lastUpdate = new Date(currentData.meta.lastUpdated);
				const now = new Date();
				dataAge = Math.floor((now - lastUpdate) / (1000 * 60)); // Age in minutes

				// Color gradient based on age (UX-03)
				if (dataAge < 60) {
					// < 1 hour: Green
					ageColor = "#4CAF50";
					ageSeverity = "fresh";
				} else if (dataAge < 360) {
					// 1-6 hours: Yellow
					ageColor = "#FFC107";
					ageSeverity = "moderate";
				} else {
					// > 6 hours: Red
					ageColor = "#FF5252";
					ageSeverity = "stale";
				}
			}

			staleWarning.style.color = ageColor;
			staleWarning.style.border = `1px solid ${ageColor}`;
			staleWarning.setAttribute("data-severity", ageSeverity);

			if (currentData.cacheFallback) {
				staleWarning.appendChild(this.createIcon("fas fa-history"));

				// Enhanced message with age (UX-03)
				let ageText = " STALE";
				if (dataAge > 0) {
					if (dataAge < 60) {
						ageText = ` ${dataAge}m ago`;
					} else if (dataAge < 1440) {
						ageText = ` ${Math.floor(dataAge / 60)}h ago`;
					} else {
						ageText = ` ${Math.floor(dataAge / 1440)}d ago`;
					}
				}

				staleWarning.appendChild(document.createTextNode(ageText));
				staleWarning.title = `Live fetch failed: Showing cached data from ${Math.floor(dataAge / 60)} hours ${dataAge % 60} minutes ago`;
			} else {
				staleWarning.appendChild(this.createIcon("fas fa-exclamation-circle"));
				staleWarning.appendChild(document.createTextNode(" INCOMPLETE"));
				staleWarning.title =
					"Live data missing statistics: Parser may need update or data not yet available";
			}

			metaInfo.appendChild(staleWarning);
		}

		// Show "Awaiting Split" badge when Phase 1 is complete but Phase 2
		// groups have not yet been announced.  This is distinct from a data
		// error - the data is valid; the league administrator simply has not
		// published the split group assignments yet.
		if (currentData && currentData.awaitingSplit) {
			const awaitingBadge = document.createElement("span");
			awaitingBadge.className = "awaiting-split-badge xsmall";
			awaitingBadge.style.marginLeft = "8px";
			awaitingBadge.style.fontWeight = "bold";
			awaitingBadge.style.padding = "2px 8px";
			awaitingBadge.style.borderRadius = "3px";
			awaitingBadge.style.color = "#64B5F6";
			awaitingBadge.style.border = "1px solid #64B5F6";
			awaitingBadge.setAttribute("aria-label", "Awaiting Phase 2 Split");
			awaitingBadge.title =
				"Phase 1 complete - awaiting the league split announcement for Phase 2 groups.";
			awaitingBadge.appendChild(this.createIcon("fas fa-hourglass-half"));
			awaitingBadge.appendChild(
				document.createTextNode(` ${this.translate("AWAITING_SPLIT")}`)
			);
			metaInfo.appendChild(awaitingBadge);
		}

		// Add manual refresh button
		const refreshBtn = document.createElement("button");
		refreshBtn.className = "refresh-btn";
		refreshBtn.title = "Refresh Data";
		refreshBtn.setAttribute("aria-label", "Refresh Data");
		refreshBtn.appendChild(this.createIcon("fas fa-sync-alt"));

		const refreshHandler = () => {
			this.requestAllLeagueData();
			const icon = refreshBtn.querySelector("i");
			if (icon) icon.classList.add("fa-spin");
			setTimeout(() => {
				if (icon) icon.classList.remove("fa-spin");
			}, 2000);
		};

		refreshBtn.addEventListener("click", refreshHandler);
		this.addKeyboardNavigation(refreshBtn, refreshHandler);
		metaInfo.appendChild(refreshBtn);

		// Add Clear Cache button when enabled
		if (this.config.clearCacheButton === true) {
			const clearBtn = document.createElement("button");
			clearBtn.className = "clear-cache-btn";
			clearBtn.title = "Clear Cache";
			clearBtn.setAttribute("aria-label", "Clear Cache");
			clearBtn.appendChild(this.createIcon("fas fa-trash-alt"));

			const clearHandler = () => {
				this.sendSocketNotification("CACHE_CLEAR_ALL");
				const icon = clearBtn.querySelector("i");
				if (icon) icon.classList.add("fa-spin");
				setTimeout(() => {
					if (icon) icon.classList.remove("fa-spin");
				}, 1500);
			};

			clearBtn.addEventListener("click", clearHandler);
			this.addKeyboardNavigation(clearBtn, clearHandler);
			metaInfo.appendChild(clearBtn);
		}

		// Pin control and countdown in header
		const pinBtn = document.createElement("button");
		pinBtn.className = "pin-btn";
		pinBtn.setAttribute("aria-pressed", this._pinned);
		pinBtn.setAttribute(
			"aria-label",
			this._pinned ? "Unpin (resume auto-cycling)" : "Pin (pause auto-cycling)"
		);
		pinBtn.title = this._pinned
			? "Unpin (resume auto-cycling)"
			: "Pin (pause auto-cycling)";
		pinBtn.appendChild(this.createIcon("fas fa-thumbtack"));

		const pinHandler = () => {
			this._pinned = !this._pinned;
			pinBtn.classList.toggle("active", this._pinned);
			pinBtn.setAttribute("aria-pressed", this._pinned);
			pinBtn.setAttribute(
				"aria-label",
				this._pinned
					? "Unpin (resume auto-cycling)"
					: "Pin (pause auto-cycling)"
			);
			pinBtn.title = this._pinned
				? "Unpin (resume auto-cycling)"
				: "Pin (pause auto-cycling)";
			if (this._pinned) {
				this._pauseCycling();
				this._stopHeaderCountdown();
			} else {
				this._resumeCyclingIfNeeded();
				this._startHeaderCountdown();
			}
		};

		pinBtn.addEventListener("click", pinHandler);
		this.addKeyboardNavigation(pinBtn, pinHandler);
		metaInfo.appendChild(pinBtn);
		const countdown = document.createElement("span");
		countdown.className = "cycle-countdown xsmall";
		countdown.style.marginLeft = "8px";
		this._countdownEl = countdown;
		metaInfo.appendChild(countdown);

		headerContainer.appendChild(metaInfo);
		wrapperFragment.appendChild(headerContainer);

		// Create league buttons container
		var buttonsContainer = document.createElement("div");
		buttonsContainer.className = "league-buttons-container";

		if (this.shouldShowLeagueButtons()) {
			const buttonsFragment = document.createDocumentFragment();
			const displayOrder = [...this.enabledLeagueCodes].sort((a, b) => {
				if (this.isWorldCupLeague(a)) return 1;
				if (this.isWorldCupLeague(b)) return -1;
				return 0;
			});

			displayOrder.forEach((leagueCode) => {
				const leagueInfo = this.getLeagueInfo(leagueCode);
				if (leagueInfo) {
					const btn = document.createElement("button");
					const normalizedCode = this.normalizeLeagueCode(leagueCode);
					const isCurrentlyActive = this.currentLeague === normalizedCode;

					btn.className = `league-btn${isCurrentlyActive ? " active" : ""}`;
					btn.title = leagueInfo.name;
					btn.setAttribute("aria-label", `Switch to ${leagueInfo.name} table`);
					btn.setAttribute("data-league", leagueCode);

					const fallbackText = document.createElement("span");
					fallbackText.className = "league-abbr";
					fallbackText.textContent = this.getLeagueAbbreviation(leagueCode);
					btn.appendChild(fallbackText);

					btn.addEventListener("click", (e) => {
						this.handleLeagueButtonClick(e);
					});
					buttonsFragment.appendChild(btn);
				}
			});
			buttonsContainer.appendChild(buttonsFragment);
		}

		this._addHorizontalScrollIndicators(buttonsContainer, wrapperFragment);

		// ===== NEW: Sub-tabs (World Cup, UEFA and canonical flat competitions) =====
		if (this.usesCompetitionSubTabs(this.currentLeague)) {
			this.ensureCurrentSubTab(this.currentLeague);
			var subTabsContainer = document.createElement("div");
			subTabsContainer.className = "wc-subtabs-container single-line";
			const subTabsFragment = document.createDocumentFragment();
			this.getCompetitionSubTabs(this.currentLeague).forEach((subTabId) => {
				const btn = document.createElement("button");
				const isKnockoutStage =
					!["Table", "Fixtures"].includes(subTabId) && !/^[A-L]$/.test(subTabId);
				btn.className = `wc-btn${isKnockoutStage ? " ko-btn" : ""}${
					this.currentSubTab === subTabId ? " active" : ""
				}`;
				btn.textContent = this.getCompetitionSubTabLabel(
					this.currentLeague,
					subTabId
				);
				btn.setAttribute(
					"aria-label",
					this.getCompetitionSubTabAriaLabel(this.currentLeague, subTabId)
				);
				btn.setAttribute(
					"aria-pressed",
					this.currentSubTab === subTabId ? "true" : "false"
				);
				btn.setAttribute("role", "tab");
				btn.addEventListener("click", () => {
					this.currentSubTab = subTabId;
					this.updateDom();
				});
				subTabsFragment.appendChild(btn);
			});

			subTabsContainer.appendChild(subTabsFragment);
			this._addHorizontalScrollIndicators(subTabsContainer, wrapperFragment);
		}

		// Create content container for the table
		var contentContainer = document.createElement("div");
		contentContainer.className = "league-content-container";

		// Show loading message if data not loaded yet
		if (!this.loaded[this.currentLeague] && !this.error) {
			if (this.config.debug) {
				Log.info(
					` MMM-SoccerStandings: Data not loaded for ${this.currentLeague}. Loaded states: ${JSON.stringify(this.loaded)}`
				);
			}

			// Safety: If for some reason this league is not being loaded, request it now
			if (this.loaded[this.currentLeague] === undefined) {
				if (this.config.debug)
					Log.warn(
						` MMM-SoccerStandings: ${this.currentLeague} was not in loaded map, requesting now`
					);
				this.loaded[this.currentLeague] = false;
				this.requestAllLeagueData();
			}

			const leagueDisplayName =
				this.getLeagueDisplayName(this.currentLeague) || this.currentLeague;

			// Show skeleton loading state for better perceived performance (DES-05)
			const skeletonLoader = document.createElement("div");
			skeletonLoader.className = "skeleton-loader";
			skeletonLoader.setAttribute("role", "status");
			skeletonLoader.setAttribute(
				"aria-label",
				`Loading ${leagueDisplayName} data`
			);

			// Skeleton header
			const skeletonHeader = document.createElement("div");
			skeletonHeader.className = "skeleton-header";

			const skeletonTitle = document.createElement("div");
			skeletonTitle.className = "skeleton-title";
			skeletonHeader.appendChild(skeletonTitle);

			const skeletonMeta = document.createElement("div");
			skeletonMeta.className = "skeleton-meta";
			skeletonHeader.appendChild(skeletonMeta);

			skeletonLoader.appendChild(skeletonHeader);

			// Skeleton table rows (show 10 rows as placeholder)
			const skeletonTable = document.createElement("div");
			skeletonTable.className = "skeleton-table";

			for (let i = 0; i < 10; i++) {
				const skeletonRow = document.createElement("div");
				skeletonRow.className = "skeleton-row";

				// Position
				const posCell = document.createElement("div");
				posCell.className = "skeleton-cell position";
				skeletonRow.appendChild(posCell);

				// Logo
				const logoCell = document.createElement("div");
				logoCell.className = "skeleton-cell logo";
				skeletonRow.appendChild(logoCell);

				// Team name
				const teamCell = document.createElement("div");
				teamCell.className = "skeleton-cell team";
				skeletonRow.appendChild(teamCell);

				// Stats (P, W, D, L, GF, GA, GD, Pts)
				for (let j = 0; j < 8; j++) {
					const statCell = document.createElement("div");
					statCell.className = "skeleton-cell stat";
					skeletonRow.appendChild(statCell);
				}

				// Form
				const formCell = document.createElement("div");
				formCell.className = "skeleton-cell form";
				skeletonRow.appendChild(formCell);

				skeletonTable.appendChild(skeletonRow);
			}

			skeletonLoader.appendChild(skeletonTable);

			// Add subtle loading text below skeleton
			const loadingText = document.createElement("div");
			loadingText.className = "dimmed xsmall";
			loadingText.style.textAlign = "center";
			loadingText.style.marginTop = "15px";
			loadingText.textContent = `${this.translate("LOADING")} ${leagueDisplayName}...`;
			loadingText.setAttribute("aria-live", "polite");
			skeletonLoader.appendChild(loadingText);

			// Add loading timeout warning after 10 seconds
			if (!this._loadingWarningTimer) {
				this._loadingWarningTimer = setTimeout(() => {
					if (!this.loaded[this.currentLeague] && loadingText) {
						const slowWarning = document.createElement("div");
						slowWarning.className = "loading-slow-warning xsmall";
						slowWarning.style.textAlign = "center";
						slowWarning.style.marginTop = "10px";
						slowWarning.style.color = "#FFC107";
						slowWarning.textContent = this.translate("LOADING_SLOW");
						slowWarning.setAttribute("role", "alert");
						skeletonLoader.appendChild(slowWarning);
					}
					this._loadingWarningTimer = null;
				}, 10000);
			}

			contentContainer.appendChild(skeletonLoader);
			contentContainer.className += " dimmed light small";
			wrapper.appendChild(wrapperFragment);
			wrapper.appendChild(contentContainer);
			return wrapper;
		}

		// Show error message if there's an error and max retries exceeded
		if (this.error && this.retryCount > this.config.maxRetries) {
			const errorState = document.createElement("div");
			errorState.className = "error-state dimmed light small";
			errorState.setAttribute("role", "alert");

			const errorIcon = document.createElement("i");
			errorIcon.className = "fas fa-exclamation-triangle error-icon";
			errorIcon.setAttribute("aria-hidden", "true");
			errorState.appendChild(errorIcon);

			// Display enhanced error message with category
			const errorText = document.createElement("div");
			const errorCategory = this.error.category
				? `[${this.error.category}] `
				: "";
			const errorMessage =
				this.error.userMessage ||
				this.error.message ||
				this.translate("SOURCE_UNAVAILABLE");
			errorText.textContent = ` ${errorCategory}${errorMessage}`;
			errorState.appendChild(errorText);

			// Display suggestion if available
			if (this.error.suggestion) {
				const suggestionText = document.createElement("div");
				suggestionText.className = "error-suggestion xsmall";
				suggestionText.textContent = `💡 ${this.error.suggestion}`;
				errorState.appendChild(suggestionText);
			}

			const retryBtn = document.createElement("button");
			retryBtn.className = "retry-btn-error";
			retryBtn.textContent = this.translate("RETRY");
			retryBtn.setAttribute("aria-label", "Retry fetching data");
			retryBtn.addEventListener("click", () => {
				this.retryCount = 0;
				this.error = null;
				this.requestAllLeagueData();
				this.updateDom();
			});
			errorState.appendChild(retryBtn);

			contentContainer.appendChild(errorState);
			wrapper.appendChild(wrapperFragment);
			wrapper.appendChild(contentContainer);
			return wrapper;
		}

		// Show retry message if retrying
		if (this.error && this.retryCount <= this.config.maxRetries) {
			const retryState = document.createElement("div");
			retryState.className = "retry-state dimmed light small";

			const retryIcon = document.createElement("i");
			retryIcon.className = "fas fa-sync fa-spin retry-icon";
			retryState.appendChild(retryIcon);

			const retryText = document.createElement("span");
			retryText.textContent = ` ${this.translate("RETRYING")} (${this.retryCount}/${this.config.maxRetries})...`;
			retryState.appendChild(retryText);

			contentContainer.appendChild(retryState);
			wrapper.appendChild(wrapperFragment);
			wrapper.appendChild(contentContainer);
			return wrapper;
		}

		// Create the table
		if (currentData) {
			if (this.usesTournamentView(this.currentLeague)) {
				contentContainer.appendChild(this.createWorldCupView(currentData));
			} else if (
				this.shouldUseCanonicalFlatSlice(this.currentLeague) &&
				currentData.teams &&
				currentData.fixtures
			) {
				contentContainer.appendChild(this.createFlatLeagueView(currentData));
			} else if (currentData.teams) {
				if (this.config.debug) {
					Log.info(
						` MMM-SoccerStandings: Creating table for ${
							this.currentLeague
						} with ${currentData.teams.length} teams`
					);
				}
				contentContainer.appendChild(
					this.createTable(currentData, this.currentLeague)
				);
			} else {
				contentContainer.textContent = this.translate("NO_DATA");
				contentContainer.className += " dimmed light small";
			}
		} else {
			if (this.config.debug) {
				Log.info(
					` MMM-SoccerStandings: No league data available for ${this.currentLeague}`
				);
			}
			contentContainer.textContent = this.translate("NO_DATA");
			contentContainer.className += " dimmed light small";
		}

		// Add sticky footer controls (toggle, source info, back-to-top)
		var backToTopControls = document.createElement("div");
		backToTopControls.className = "back-to-top-controls visible"; // Start visible (Task: sticky source footer)
		backToTopControls.style.display = "flex";
		backToTopControls.style.justifyContent = "space-between";
		backToTopControls.style.alignItems = "center";
		backToTopControls.style.width = "100%";
		backToTopControls.style.boxSizing = "border-box";

		// Center: Source information
		if (currentData) {
			const sourceContainer = this.createSourceInfoElement(currentData);
			if (sourceContainer) {
				backToTopControls.appendChild(sourceContainer);
			}
		}

		contentContainer.appendChild(backToTopControls);

		wrapperFragment.appendChild(contentContainer);
		wrapper.appendChild(wrapperFragment);

		// Set up scroll event listener and initialize visibility
		setTimeout(() => {
			// FIX: Also check for UEFA split-view scroll containers
			const tableContainer =
				wrapper.querySelector(".league-body-scroll") ||
				wrapper.querySelector(".league-content-container") ||
				wrapper.querySelector(".uefa-section-scroll");
			const backToTopControls = wrapper.querySelector(".back-to-top-controls");
			if (tableContainer && backToTopControls) {
				// Attach scroll event listener for visibility state and pause/resume behavior
				tableContainer.addEventListener(
					"scroll",
					() => {
						this.updateScrollButtons();
					},
					{ passive: true }
				);
				this._attachScrollPause(tableContainer);
				// Initialize visibility states
				this.updateScrollButtons();
			}
			// Compute dynamic team name width
			this.updateTeamNameColumnWidth();
			// Start header countdown after DOM is ready
			this._startHeaderCountdown();
		}, 100);

		return wrapper;
	},

	// Create the league table
	createTable(leagueData, leagueKey) {
		// Create the outer wrapper that holds everything
		const outerWrapper = document.createElement("div");
		outerWrapper.className = "league-table-wrapper-v2";
		if (leagueKey) outerWrapper.classList.add(leagueKey);

		// --- 1. Header Table (Sticky) ---
		const headerContainer = document.createElement("div");
		headerContainer.className = "league-header-sticky";
		const headerTable = document.createElement("table");
		headerTable.className = "small spfl-table header-only";
		headerTable.setAttribute("role", "table");
		headerTable.setAttribute(
			"aria-label",
			`${this.getLeagueDisplayName(this.currentLeague)} Standings Table`
		);

		const thead = document.createElement("thead");
		const headerRow = document.createElement("tr");
		headerRow.setAttribute("role", "row");

		if (this.config.showPosition) {
			headerRow.appendChild(
				this.createTableHeader(
					this.translate("COL_POSITION"),
					"position-header"
				)
			);
		}

		headerRow.appendChild(
			this.createTableHeader(this.translate("COL_TEAM"), "team-header")
		);

		if (this.config.showPlayedGames) {
			headerRow.appendChild(
				this.createTableHeader(this.translate("COL_PLAYED"), "played-header")
			);
		}
		if (this.config.showWon) {
			headerRow.appendChild(
				this.createTableHeader(this.translate("COL_WON"), "won-header")
			);
		}
		if (this.config.showDrawn) {
			headerRow.appendChild(
				this.createTableHeader(this.translate("COL_DRAWN"), "drawn-header")
			);
		}
		if (this.config.showLost) {
			headerRow.appendChild(
				this.createTableHeader(this.translate("COL_LOST"), "lost-header")
			);
		}
		if (this.config.showGoalsFor) {
			headerRow.appendChild(
				this.createTableHeader(this.translate("COL_GOALS_FOR"), "gf-header")
			);
		}
		if (this.config.showGoalsAgainst) {
			headerRow.appendChild(
				this.createTableHeader(this.translate("COL_GOALS_AGAINST"), "ga-header")
			);
		}
		if (this.config.showGoalDifference) {
			headerRow.appendChild(
				this.createTableHeader(
					this.translate("COL_GOAL_DIFFERENCE"),
					"gd-header"
				)
			);
		}
		if (this.config.showPoints) {
			headerRow.appendChild(
				this.createTableHeader(this.translate("COL_POINTS"), "points-header")
			);
		}
		if (this.config.showForm) {
			headerRow.appendChild(
				this.createTableHeader(this.translate("COL_FORM"), "form-header")
			);
		}

		thead.appendChild(headerRow);
		headerTable.appendChild(thead);
		headerContainer.appendChild(headerTable);
		outerWrapper.appendChild(headerContainer);

		// --- 2. Body Scroll Container ---
		const scrollContainer = document.createElement("div");
		scrollContainer.className = "league-body-scroll";
		const bodyTable = document.createElement("table");
		bodyTable.className = "small spfl-table body-only";
		bodyTable.setAttribute("role", "table");
		bodyTable.setAttribute(
			"aria-label",
			`${this.getLeagueDisplayName(this.currentLeague)} Standings Data`
		);
		const tbody = document.createElement("tbody");

		// Compute column count for split-group separator colspan
		let _colCount = 1; // team name column always present
		if (this.config.showPosition) _colCount++;
		if (this.config.showPlayedGames) _colCount++;
		if (this.config.showWon) _colCount++;
		if (this.config.showDrawn) _colCount++;
		if (this.config.showLost) _colCount++;
		if (this.config.showGoalsFor) _colCount++;
		if (this.config.showGoalsAgainst) _colCount++;
		if (this.config.showGoalDifference) _colCount++;
		if (this.config.showPoints) _colCount++;
		if (this.config.showForm) _colCount++;

		// Build the list of group segments to render.
		// When splitGroups is present (post-split leagues), render each group with a label separator.
		// Otherwise render a single unlabelled group from leagueData.teams.
		const _groupsToRender = [];
		if (
			leagueData.splitGroups &&
			Array.isArray(leagueData.splitGroups) &&
			leagueData.splitGroups.length > 1
		) {
			leagueData.splitGroups.forEach((group) => {
				_groupsToRender.push({ label: group.label, teams: group.teams || [] });
			});
		} else {
			_groupsToRender.push({ label: null, teams: leagueData.teams || [] });
		}

		_groupsToRender.forEach((group, groupIndex) => {
			// Insert a labelled separator row before each group (only for 2nd+ groups).
			// Skipping groupIndex 0 ensures the first tbody row is always a data row,
			// which is required for table-layout:fixed to correctly size all columns.
			if (_groupsToRender.length > 1 && group.label && groupIndex > 0) {
				const separatorRow = document.createElement("tr");
				separatorRow.className = "split-group-separator";
				separatorRow.setAttribute("role", "row");
				const separatorCell = document.createElement("td");
				separatorCell.colSpan = _colCount;
				separatorCell.className = "split-group-label";
				separatorCell.setAttribute("role", "cell");
				separatorCell.textContent = group.label;
				separatorRow.appendChild(separatorCell);
				tbody.appendChild(separatorRow);
			}

			// Apply maxTeams limit only to the first group
			let teamsToShow = group.teams;
			if (groupIndex === 0 && this.config.maxTeams > 0) {
				teamsToShow = teamsToShow.slice(0, this.config.maxTeams);
			}

			teamsToShow.forEach((team, index) => {
				var row = document.createElement("tr");
				row.className = "team-row";
				// Add alternating shade on the second+ groups so they visually separate
				if (groupIndex % 2 === 1) row.classList.add("split-group-alt");
				row.setAttribute("role", "row");
				row.setAttribute("aria-rowindex", index + 1);
				if (team.name) {
					row.setAttribute("data-team-name", team.name);
				}
				const pos = team.position || "-";
				const pts = team.points || "0";

				row.setAttribute(
					"aria-label",
					`${team.name}, rank ${pos}, ${pts} points`
				);

				if (this.config.colored) {
					const isUEFA = this.isUEFATournamentLeague(leagueKey);

					if (isUEFA) {
						// UEFA League Phase: 1-8 Promotion, 25-36 Elimination
						if (team.position <= 8) {
							row.classList.add("promotion-zone");
						} else if (team.position >= 25 && team.position <= 36) {
							row.classList.add("uefa-elimination-zone");
						}
					} else if (!this.isWorldCupLeague(leagueKey)) {
						// For split-league groups, colour based on position within the group
						if (groupIndex === 0) {
							// Championship / top group: top positions highlighted
							if (team.position <= 2) row.classList.add("promotion-zone");
							else if (team.position <= 4) row.classList.add("uefa-zone");
						} else {
							// Relegation / lower groups: bottom positions highlighted
							if (team.position >= teamsToShow.length - 1)
								row.classList.add("relegation-zone");
						}
					}
				}

				if (this._isHighlightedTeam(team.name)) {
					row.classList.add("highlighted");
				}

				// Apply custom team colors (DES-06)
				if (
					this.config.customTeamColors &&
					typeof this.config.customTeamColors === "object"
				) {
					const customColor = this.config.customTeamColors[team.name];
					if (customColor) {
						// Validate hex color format
						if (/^#[0-9A-F]{6}$/i.test(customColor)) {
							row.style.backgroundColor = customColor;
							row.setAttribute("data-custom-color", customColor);
							if (this.config.debug) {
								Log.info(
									`[CUSTOM-COLOR] Applied ${customColor} to ${team.name}`
								);
							}
						} else if (this.config.debug) {
							Log.warn(
								`[CUSTOM-COLOR] Invalid color format for ${team.name}: ${customColor}. Use #RRGGBB format.`
							);
						}
					}
				}

				if (this.config.showPosition) {
					var posCell = document.createElement("td");
					posCell.textContent = Number.isFinite(team.position)
						? team.position
						: "-";
					posCell.className = "position-cell";
					row.appendChild(posCell);
				}

				var teamCell = document.createElement("td");
				teamCell.className = "team-cell";

				if (this.config.showTeamLogos && team.logo) {
					var img = document.createElement("img");
					img.className = "team-logo";
					img.alt = "";
					img.setAttribute("aria-hidden", "true");
					img.onerror = function () {
						this.remove();
					};
					this.setupImageLazyLoading(img, team.logo);
					teamCell.appendChild(img);
				}

				var nameSpan = document.createElement("span");
				nameSpan.className = "team-name";
				nameSpan.textContent = this.translateTeamName(team.name);
				teamCell.appendChild(nameSpan);
				row.appendChild(teamCell);

				if (this.config.showPlayedGames) {
					var td = document.createElement("td");
					td.textContent = Number.isFinite(team.played) ? team.played : "-";
					td.className = "played-cell";
					row.appendChild(td);
				}
				if (this.config.showWon) {
					var td = document.createElement("td");
					td.textContent = Number.isFinite(team.won) ? team.won : "-";
					td.className = "won-cell";
					row.appendChild(td);
				}
				if (this.config.showDrawn) {
					var td = document.createElement("td");
					td.textContent = Number.isFinite(team.drawn) ? team.drawn : "-";
					td.className = "drawn-cell";
					row.appendChild(td);
				}
				if (this.config.showLost) {
					var td = document.createElement("td");
					td.textContent = Number.isFinite(team.lost) ? team.lost : "-";
					td.className = "lost-cell";
					row.appendChild(td);
				}
				if (this.config.showGoalsFor) {
					var td = document.createElement("td");
					td.textContent = Number.isFinite(team.goalsFor) ? team.goalsFor : "-";
					td.className = "gf-cell";
					row.appendChild(td);
				}
				if (this.config.showGoalsAgainst) {
					var td = document.createElement("td");
					td.textContent = Number.isFinite(team.goalsAgainst)
						? team.goalsAgainst
						: "-";
					td.className = "ga-cell";
					row.appendChild(td);
				}
				if (this.config.showGoalDifference) {
					var td = document.createElement("td");
					var gd = Number.isFinite(team.goalDifference)
						? team.goalDifference
						: null;
					td.textContent = gd === null ? "-" : gd > 0 ? `+${gd}` : String(gd);
					td.className = "gd-cell";
					if (gd > 0) td.classList.add("positive");
					else if (gd < 0) td.classList.add("negative");
					row.appendChild(td);
				}
				if (this.config.showPoints) {
					var td = document.createElement("td");
					td.textContent = Number.isFinite(team.points) ? team.points : "-";
					td.className = "points-cell";
					row.appendChild(td);
				}
				if (this.config.showForm) {
					var formCell = document.createElement("td");
					formCell.className = "form-cell";
					var formWrapper = document.createElement("div");
					formWrapper.className = this.config.enhancedIndicatorShapes
						? "form-tokens form-tokens--enhanced"
						: "form-tokens form-tokens--flat";

					var formArr = Array.isArray(team.form) ? team.form : [];
					var maxGames = Math.max(1, Number(this.config.formMaxGames) || 5);
					if (formArr.length > maxGames) formArr = formArr.slice(-maxGames);

					for (var p = 0; p < maxGames - formArr.length; p++) {
						var span = document.createElement("span");
						span.className = "form-missing fas fa-circle-question";
						formWrapper.appendChild(span);
					}

					formArr.forEach((match) => {
						var span = document.createElement("span");
						// span.textContent = match.result;
						if (match.result === "W")
							span.className = "form-win fas fa-check-circle";
						else if (match.result === "D")
							span.className = "form-draw fas fa-minus-circle";
						else if (match.result === "L")
							span.className = "form-loss fas fa-xmark-circle";
						else span.className = "form-missing fas fa-question-circle";
						formWrapper.appendChild(span);
					});
					formCell.appendChild(formWrapper);
					row.appendChild(formCell);
				}

				tbody.appendChild(row);
			}); // end teamsToShow.forEach
		}); // end _groupsToRender.forEach

		bodyTable.appendChild(tbody);

		scrollContainer.appendChild(bodyTable);

		outerWrapper.appendChild(scrollContainer);

		setTimeout(() => {
			const firstHighlighted = scrollContainer.querySelector(".highlighted");
			if (firstHighlighted) {
				firstHighlighted.scrollIntoView({
					behavior: "smooth",
					block: "center"
				});
			}
		}, 1000);

		return outerWrapper;
	},

	// Set up sub-tab cycling for World Cup and canonical flat competitions
	scheduleWorldCupSubtabCycling() {
		// If paused due to scroll or pinned, do not schedule
		if (this.isScrolling || this._pinned) return;
		// Clear any existing WC subtab timer
		if (this.wcSubtabTimer) {
			clearInterval(this.wcSubtabTimer);
			this.wcSubtabTimer = null;
		}
		if (this.wcInitialDelayTimer) {
			clearTimeout(this.wcInitialDelayTimer);
			this.wcInitialDelayTimer = null;
		}

		// Respect user toggle for sub-tab cycling
		if (this.config && this.config.autoCycleWcSubtabs === false) {
			return;
		}

		if (!this.config.autoCycle) {
			return;
		}

		if (
			this.shouldUseCanonicalFlatSlice(this.currentLeague) &&
			!this.isUEFATournamentLeague(this.currentLeague)
		) {
			const currentData = this.getRenderLeagueData(this.currentLeague);
			if (!currentData || !Array.isArray(currentData.fixtures) || !currentData.fixtures.length) {
				this.currentSubTab = "Table";
				return;
			}

			const interval = this.config.wcSubtabCycleInterval || 15000;
			const order = ["Table", "Fixtures"];
			if (!order.includes(this.currentSubTab)) {
				this.currentSubTab = "Table";
			}

			this.wcInitialDelayTimer = setTimeout(() => {
				let idx = order.indexOf(this.currentSubTab);
				this.wcSubtabTimer = setInterval(() => {
					idx = (idx + 1) % order.length;
					this.currentSubTab = order[idx];
					this.updateDom();
				}, interval);
			}, interval);
			return;
		}

		// Only run WC-specific logic when WC league is active
		if (
			!this.isWorldCupLeague(this.currentLeague) ||
			!this.config.autoCycle
		) {
			return;
		}

		const advanceStageIfComplete = () => {
			// If groups complete, stop group cycling and jump to Rd32
			if (this.isWorldCupStageComplete("GROUPS")) {
				this.currentSubTab = "Rd32";
				this.updateDom();
				return;
			}
			// If Playoff complete, set Rd16; then QF; then SF; then TP; then Final
			const order = ["Playoff", "Rd32", "Rd16", "QF", "SF", "TP", "Final"];
			for (let i = 0; i < order.length - 1; i++) {
				if (
					this.currentSubTab === order[i] &&
					this.isWorldCupStageComplete(order[i])
				) {
					this.currentSubTab = order[i + 1];
					this.updateDom();
					break;
				}
			}
		};

		const groupsToShow = this.getWorldCupGroupSubTabs();

		// If current subtab is a group, set up cycling through A-L
		const isCurrentGroup = groupsToShow.includes(this.currentSubTab);
		const interval = this.config.wcSubtabCycleInterval || 15000;

		if (isCurrentGroup) {
			// Initial delay to show default group for one interval before cycling
			this.wcInitialDelayTimer = setTimeout(() => {
				let idx = groupsToShow.indexOf(this.currentSubTab);
				this.wcSubtabTimer = setInterval(() => {
					// If groups are completed, advance stage and stop cycling groups
					if (this.isWorldCupStageComplete("GROUPS")) {
						clearInterval(this.wcSubtabTimer);
						this.wcSubtabTimer = null;
						this.currentSubTab = "Rd32";
						this.updateDom();
						return;
					}
					idx = (idx + 1) % groupsToShow.length;
					this.currentSubTab = groupsToShow[idx];
					this.updateDom();
				}, interval);
			}, interval);
		} else {
			// Not a group: periodically evaluate stage completion to auto-advance through knockouts
			this.wcSubtabTimer = setInterval(() => {
				advanceStageIfComplete();
			}, interval);
		}
	},

	// Check if we are in the UEFA off-season (July to late August)
	isUEFAOffSeason() {
		if (!this.isUEFATournamentLeague(this.currentLeague)) return false;

		const now = new Date();
		const month = now.getMonth(); // 0 = Jan, 6 = July, 7 = Aug

		// Window starts July 1st (roughly 30 days after late May finals)
		// Window ends when draw is made (usually late August)
		if (month === 6 || month === 7) {
			const currentData = this.getRenderLeagueData(this.currentLeague);
			const hasData =
				currentData &&
				((currentData.teams && currentData.teams.length > 0) ||
					(currentData.fixtures && currentData.fixtures.length > 0));

			// If we are in July or August and have no data, it's off-season
			return !hasData;
		}

		return false;
	},

	// MagicMirror lifecycle hooks to manage timers cleanly
	suspend() {
		this._pauseCycling();
		this._stopHeaderCountdown();
		if (this.updateTimer) {
			clearTimeout(this.updateTimer);
			this.updateTimer = null;
		}
	},
	resume() {
		this.scheduleUpdate();
		this._resumeCyclingIfNeeded();
		this._startHeaderCountdown();
	},

	// Header countdown helpers
	_startHeaderCountdown() {
		this._stopHeaderCountdown();
		if (!this._countdownEl) return;
		if (this._pinned || this.isScrolling) {
			this._countdownEl.textContent = this.translate("CYCLE_PAUSED");
			return;
		}
		const base = this.isWorldCupLeague(this.currentLeague)
			? this.config.wcSubtabCycleInterval || 15000
			: this.config.cycleInterval || 15000;
		if (!base || base <= 0) {
			this._countdownEl.textContent = "";
			return;
		}
		if (base >= 60 * 60 * 1000) {
			this._countdownEl.textContent = "";
			return;
		}
		let remaining = Math.ceil(base / 1000);
		const label = this.isWorldCupLeague(this.currentLeague)
			? "SUB_TAB"
			: "LEAGUE";
		const tick = () => {
			if (!this._countdownEl) return;
			this._countdownEl.textContent = this.translate("NEXT_CYCLE_IN", {
				label: this.translate(label),
				remaining
			});
			remaining -= 1;
			if (remaining < 0) remaining = Math.ceil(base / 1000);
		};
		tick();
		this._countdownTimer = setInterval(tick, 1000);
	},
	_stopHeaderCountdown() {
		if (this._countdownTimer) {
			clearInterval(this._countdownTimer);
			this._countdownTimer = null;
		}
		if (this._countdownEl) {
			this._countdownEl.textContent =
				this._pinned || this.isScrolling ? this.translate("CYCLE_PAUSED") : "";
		}
	},

	// ===== NEW: World Cup & UEFA View Renderer =====
	createWorldCupView(currentData) {
		var container = document.createElement("div");
		container.className = "wc-view-container";
		const fragment = document.createDocumentFragment();

		const subTab = this.currentSubTab;
		const tSubTab = this.translate(
			subTab.trim().toUpperCase().replace(/\s+/g, "_")
		);

		// Handle "Table" sub-tab (for UEFA)
		if (subTab === "Table") {
			if (currentData.teams && currentData.teams.length > 0) {
				const mockLeagueData = {
					teams: currentData.teams,
					source: currentData.source,
					lastUpdated: currentData.lastUpdated
				};
				fragment.appendChild(
					this.createTable(mockLeagueData, this.currentLeague)
				);
				container.appendChild(fragment);
				return container;
			} else if (this.isUEFAOffSeason()) {
				var offMsg = document.createElement("div");
				offMsg.className = "bright small";
				offMsg.style.textAlign = "center";
				offMsg.style.marginTop = "20px";
				offMsg.textContent = this.translate("AWAITING_DRAW");
				fragment.appendChild(offMsg);
				container.appendChild(fragment);
				return container;
			}
		}

		// Handle Knockout Rounds (World Cup: Rd32, Rd16, QF, SF, TP, Final; UEFA: Playoff, Rd16, QF, SF, Final)
		const allKnockoutStages = [
			"Rd32",
			"Rd16",
			"QF",
			"SF",
			"TP",
			"Final",
			"Playoff"
		];
		if (allKnockoutStages.includes(subTab)) {
			const knockoutFixtures = this.getKnockoutFixturesForSubTab(
				currentData,
				subTab
			);

			// STAGED APPROACH (Task: UEFA 3-stage display for ALL knockout rounds)
			// FIX: Apply to ALL UEFA knockout stages (Playoff, Rd16, QF, SF), not just Playoff
			const isUEFA = this.isUEFATournamentLeague(this.currentLeague);
			const uefaTwoLeggedStages = ["Playoff", "Rd16", "QF", "SF"];

			if (
				isUEFA &&
				uefaTwoLeggedStages.includes(subTab) &&
				(currentData.uefaStages || currentData.fixtures)
			) {
				// Recompute results/today/future buckets from the raw fixture list using the
				// ACTUAL current date.  The pre-computed uefaStages stored in the cache are
				// built at parse time (server-side) and become stale on the following day -
				// e.g. Feb 24 fixtures remain in "today" when the cache is served on Feb 25.
				// Re-classifying here guarantees correct bucket membership regardless of when
				// the cache was written.
				const todayStr = this.getCurrentDate().toISOString().split("T")[0];
				const allFixtures = currentData.fixtures || [];

				const recomputedResults = allFixtures.filter((f) => {
					const status = (f.status || "").toUpperCase();
					if (
						status === "FT" ||
						status === "PEN" ||
						status === "PENS" ||
						status === "AET"
					)
						return true;
					if (f.live === true) return true;
					if (/\d+'|HT|LIVE/i.test(status)) return true;
					// BBC sometimes omits the FT status marker for completed fixtures.
					// Any fixture on a past date with no live flag is treated as finished.
					if (!status && !f.live && f.date && f.date < todayStr) return true;
					return false;
				});

				const recomputedLive = allFixtures.filter((f) => {
					if (f.live === true) return true;
					const status = (f.status || "").toUpperCase();
					return /\d+'|HT|LIVE/i.test(status);
				});

				const recomputedToday = allFixtures.filter((f) => {
					if (f.date !== todayStr) return false;
					const status = (f.status || "").toUpperCase();
					const isFinishedOrLive =
						status === "FT" ||
						status === "PEN" ||
						status === "PENS" ||
						status === "AET" ||
						status === "LIVE" ||
						f.live ||
						/\d+'|HT/i.test(status);
					// A today fixture with no status and no live flag is assumed finished
					if (!status && !f.live) return false;
					return !isFinishedOrLive;
				});

				const recomputedFuture = allFixtures.filter((f) => {
					if (f.date <= todayStr) return false;
					const status = (f.status || "").toUpperCase();
					const isFinishedOrLive =
						status === "FT" ||
						status === "PEN" ||
						status === "PENS" ||
						status === "AET" ||
						status === "LIVE" ||
						f.live ||
						/\d+'|HT/i.test(status);
					return !isFinishedOrLive;
				});

				const combinedResults = [
					...recomputedLive,
					...recomputedResults.filter((f) => !recomputedLive.includes(f))
				];

				const stages = {
					results: combinedResults,
					today: recomputedToday,
					future: recomputedFuture
				};

				if (this.config.debug) {
					Log.info(
						`[UEFA-STAGES] Recomputed for today=${todayStr}: results=${stages.results.length} today=${stages.today.length} future=${stages.future.length}`
					);
				}

				// Map each stage to its typical month(s) for filtering.
				// Broadened to avoid missing fixtures due to scheduling overlaps.
				const stageMonthMap = {
					Playoff: ["01", "02", "03"], // Jan (unlikely), Feb (main), March (rare)
					Rd16: ["02", "03", "04"], // Feb, March (main), April (rare)
					QF: ["03", "04", "05"], // March, April (main), May (rare)
					SF: ["04", "05", "06"] // April, May (main), June (rare)
				};

				const allowedMonths = stageMonthMap[subTab] || [];

				// Filter fixtures to only show those in the appropriate month(s) for this stage.
				//
				// BUG-G FIX: The previous OR logic (month match || stage match) caused fixtures
				// from one stage (e.g. Playoff) to bleed onto another tab (e.g. Rd16) when both
				// stages share the same month (February).  Correct priority:
				//   1. Fixture has a recognised stage label  -> MUST match current tab exactly.
				//   2. Fixture has no/unknown stage          -> fall back to month-based check.
				const knownStages = ["PLAYOFF", "RD16", "QF", "SF", "FINAL", "GS"];
				const currentStageUpper = subTab.toUpperCase();

				const filterStageFixtures = (fixtures) => {
					return fixtures.filter((f) => {
						if (!f.date) return false;
						const fixtureStage = (f.stage || "").toUpperCase();
						const hasKnownStage = knownStages.includes(fixtureStage);

						if (hasKnownStage) {
							// Explicit stage label present - must match this tab exactly.
							return fixtureStage === currentStageUpper;
						}
						// No recognised stage - fall back to month-based filtering.
						const month = f.date.split("-")[1];
						return allowedMonths.includes(month);
					});
				};

				// Sort fixtures by date and time
				const sortByDateTime = (a, b) => {
					if (a.date !== b.date) return a.date.localeCompare(b.date);
					const timeA = a.time || "00:00";
					const timeB = b.time || "00:00";
					return timeA.localeCompare(timeB);
				};

				const stageResults = filterStageFixtures(stages.results || []);
				const stageToday = filterStageFixtures(stages.today || []);
				const stageFuture = filterStageFixtures(stages.future || []);

				stageResults.sort(sortByDateTime);
				stageToday.sort(sortByDateTime);
				stageFuture.sort(sortByDateTime);

				// Determine if the round is completed (00:01 on the day after the last kickoff)
				const allStageFixtures = [
					...stageResults,
					...stageToday,
					...stageFuture
				];
				let lastKickoffDate = "";
				allStageFixtures.forEach((f) => {
					if (f.date && f.date > lastKickoffDate) {
						lastKickoffDate = f.date;
					}
				});

				const isRoundCompleted = lastKickoffDate && todayStr > lastKickoffDate;

				if (this.config.debug && isRoundCompleted) {
					Log.info(
						`[UEFA-COMPLETION] Round ${subTab} completed. Last kickoff: ${lastKickoffDate}, Today: ${todayStr}. Maximising results section.`
					);
				}

				// FIX: Create split-view layout for Results and Future Fixtures
				// Sections dynamically share increased height (+60px total)
				const splitViewContainer = document.createElement("div");
				splitViewContainer.className = "uefa-split-view-container";

				const hasResults = stageResults.length > 0;
				const hasUpcoming = stageToday.length + stageFuture.length > 0;

				if (hasResults && hasUpcoming) {
					splitViewContainer.classList.add("dual-sections");
				} else if (hasResults) {
					splitViewContainer.classList.add("only-results");
				} else if (hasUpcoming) {
					splitViewContainer.classList.add("only-upcoming");
				}

				// Section 1: Results (Finished and Live matches)
				if (hasResults) {
					const resultsWrapper = document.createElement("div");
					resultsWrapper.className = "uefa-section-wrapper results-section";

					const resultsTitle = document.createElement("div");
					resultsTitle.className = "wc-title";
					resultsTitle.textContent = this.translate("RESULTS");
					resultsWrapper.appendChild(resultsTitle);

					const resultsScroll = document.createElement("div");
					resultsScroll.className = "uefa-section-scroll";
					resultsScroll.appendChild(
						this.createFixturesTable(stageResults, false)
					);
					resultsWrapper.appendChild(resultsScroll);

					splitViewContainer.appendChild(resultsWrapper);
				}

				// Section 2: Today's Fixtures (if any)
				// Merge today's fixtures into Future section for cleaner layout
				const allUpcoming = [...stageToday, ...stageFuture];
				allUpcoming.sort(sortByDateTime);

				// Section 3: Future Fixtures (Upcoming matches including second legs)
				if (allUpcoming.length > 0) {
					const futureWrapper = document.createElement("div");
					futureWrapper.className = `uefa-section-wrapper future-section${
						isRoundCompleted ? " minimized-section" : ""
					}`;

					const futureTitle = document.createElement("div");
					futureTitle.className = "wc-title";
					futureTitle.textContent = this.translate("UPCOMING_FIXTURES");
					futureWrapper.appendChild(futureTitle);

					const futureScroll = document.createElement("div");
					futureScroll.className = "uefa-section-scroll";
					futureScroll.appendChild(
						this.createFixturesTable(allUpcoming, false)
					);
					futureWrapper.appendChild(futureScroll);

					splitViewContainer.appendChild(futureWrapper);
				}

				// Only append split view if we have at least one section
				if (stageResults.length > 0 || allUpcoming.length > 0) {
					fragment.appendChild(splitViewContainer);
				} else {
					var msg = document.createElement("div");
					msg.className = "dimmed small";
					msg.style.textAlign = "center";
					msg.textContent = this.translate("FIXTURES_NOT_AVAILABLE", {
						subTab: tSubTab !== subTab && tSubTab !== "" ? tSubTab : subTab
					});
					fragment.appendChild(msg);
				}
			} else {
				// Standard view for other stages/leagues
				var title = document.createElement("div");
				title.className = "wc-title";
				title.textContent = this.translate("SUBTAB_FIXTURES", {
					subTab: tSubTab !== subTab && tSubTab !== "" ? tSubTab : subTab
				});
				fragment.appendChild(title);

				if (knockoutFixtures.length > 0) {
					fragment.appendChild(this.createFixturesTable(knockoutFixtures));
				} else {
					var msg = document.createElement("div");
					msg.className = "dimmed small";
					msg.style.textAlign = "center";
					msg.style.marginTop = "10px";
					if (this.isUEFAOffSeason()) {
						msg.textContent = this.translate("AWAITING_DRAW");
						msg.className = "bright small";
					} else {
						msg.textContent = this.translate("FIXTURES_NOT_AVAILABLE", {
							subTab: tSubTab !== subTab && tSubTab !== "" ? tSubTab : subTab
						});
					}
					fragment.appendChild(msg);
				}
			}
			container.appendChild(fragment);
			return container;
		}

		// Handle Group View (A-L) - for World Cup
		const groupData = currentData.groups && currentData.groups[subTab];
		if (groupData) {
			const stickyWrapper = document.createElement("div");
			stickyWrapper.className = "wc-sticky-top";

			var groupTitle = document.createElement("div");
			groupTitle.className = "wc-title";
			groupTitle.textContent = `${this.translate("GROUP")} ${subTab}`;
			stickyWrapper.appendChild(groupTitle);

			// Re-use createTable but filter for this group
			const mockLeagueData = {
				teams: groupData,
				source: currentData.source,
				lastUpdated: currentData.lastUpdated
			};
			// We append the table to the sticky wrapper
			stickyWrapper.appendChild(
				this.createTable(mockLeagueData, this.currentLeague)
			);

			// Add subtitles to the sticky wrapper too
			var fixTitle = document.createElement("div");
			fixTitle.className = "wc-subtitle";
			fixTitle.textContent = this.translate("GROUP_FIXTURES", {
				group: subTab
			});
			stickyWrapper.appendChild(fixTitle);

			fragment.appendChild(stickyWrapper);

			// Add fixtures for this group (outside the sticky wrapper so they scroll)
			const groupFixtures = (currentData.fixtures || []).filter((f) => {
				// Stage must be either 'GS' or match the specific group letter (subTab)
				const isValidStage = f.stage === "GS" || f.stage === subTab;
				if (!isValidStage) return false;

				const teamNames = groupData.map((t) => this.normalizeTeamName(t.name));
				const hNorm = this.normalizeTeamName(f.homeTeam);
				const aNorm = this.normalizeTeamName(f.awayTeam);
				return teamNames.includes(hNorm) && teamNames.includes(aNorm);
			});

			if (groupFixtures.length > 0) {
				fragment.appendChild(this.createFixturesTable(groupFixtures));
			}
		} else {
			const noDataMsg = document.createElement("div");
			noDataMsg.textContent = this.translate("NO_GROUP_DATA", {
				group: subTab
			});
			noDataMsg.className = "dimmed light small";
			fragment.appendChild(noDataMsg);
		}

		container.appendChild(fragment);
		return container;
	},

	// ===== NEW: Create Fixtures Table =====
	createFixturesTable(fixtures, showHeader = true) {
		const outerWrapper = document.createElement("div");
		outerWrapper.className = "fixtures-container";

		if (!fixtures || fixtures.length === 0) return outerWrapper;

		// Sort fixtures by timestamp or date
		fixtures.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

		// Apply date range filter (UX-05)
		fixtures = this.filterFixturesByDate(fixtures);

		// Check if we should use the enhanced scrollable view (World Cup or UEFA)
		const useEnhancedView = this.usesCompetitionSubTabs(this.currentLeague);
		let columnNames = [
			"Date",
			"Time",
			"Home Team",
			"Home Logo",
			"Score",
			"Away Logo",
			"Away Team",
			"Venue"
		];

		if (useEnhancedView) {
			const wrapperV2 = document.createElement("div");
			wrapperV2.className = "fixtures-wrapper-v2";

			// 1. Header Table (Sticky/Fixed)
			if (showHeader) {
				const headerContainer = document.createElement("div");
				headerContainer.className = "fixtures-header-container";
				const headerTable = document.createElement("table");
				headerTable.className = "wc-fixtures-table-v2 header-only";

				const thead = document.createElement("thead");
				const headerRow = document.createElement("tr");
				// Order: Date, Time, Home Team, Home Logo, Score, Away Logo, Away Team, Venue
				columnNames.forEach((col) => {
					const th = document.createElement("th");
					th.textContent = col;
					th.className = `fixture-header-${col.toLowerCase().replace(/\s+/g, "-")}`;
					headerRow.appendChild(th);
				});
				thead.appendChild(headerRow);
				headerTable.appendChild(thead);
				headerContainer.appendChild(headerTable);
				wrapperV2.appendChild(headerContainer);
			}

			// 2. Body Container
			const scrollContainer = document.createElement("div");
			scrollContainer.className = "fixtures-body-scroll";

			const bodyTable = document.createElement("table");
			bodyTable.className = "wc-fixtures-table-v2 body-only";
			const tbody = document.createElement("tbody");

			let foundCurrent = false;
			const now = this.getCurrentDate().getTime();
			// Use local date in YYYY-MM-DD format for comparison
			const today = this.getCurrentDateString();

			fixtures.forEach((fix, index) => {
				const row = document.createElement("tr");
				row.className = "fixture-row-v2";

				// Task: Color indicators for live, finished and upcoming fixtures
				if (fix.live) {
					row.classList.add("live");
				} else if (
					fix.status === "FT" ||
					fix.status === "AET" ||
					fix.status === "PEN" ||
					fix.status === "PENS" ||
					(!fix.status && !fix.live && fix.date && fix.date < today)
				) {
					row.classList.add("finished");
				} else {
					row.classList.add("upcoming");
				}

				// Special auto-scroll logic for two-legged knockout rounds
				const twoLeggedMap = { Playoff: 8, Rd32: 8, Rd16: 8, QF: 4, SF: 2 };
				const firstLegCount = twoLeggedMap[this.currentSubTab];
				if (
					firstLegCount &&
					!foundCurrent &&
					fixtures.length >= firstLegCount * 2
				) {
					// Check if all of the first leg matches are finished
					const firstLegsFinished = fixtures
						.slice(0, firstLegCount)
						.every(
							(f) =>
								f.status === "FT" || f.status === "PEN" || f.status === "AET"
						);
					if (firstLegsFinished && index === firstLegCount) {
						row.classList.add("current-fixture");
						foundCurrent = true;
					}
				}

				// Standard Identification of current fixture for auto-scroll
				// Priority: 1. Live matches, 2. Today's matches, 3. First upcoming match
				if (!foundCurrent) {
					if (
						fix.live ||
						fix.date === today ||
						(fix.timestamp && fix.timestamp > now)
					) {
						row.classList.add("current-fixture");
						foundCurrent = true;
					}
				}

				if (
					this._isHighlightedTeam(fix.homeTeam) ||
					this._isHighlightedTeam(fix.awayTeam)
				) {
					row.classList.add("highlighted");
				}

				this._buildFixtureRowContent(row, fix, columnNames);
				tbody.appendChild(row);
			});

			bodyTable.appendChild(tbody);
			scrollContainer.appendChild(bodyTable);
			wrapperV2.appendChild(scrollContainer);

			outerWrapper.appendChild(wrapperV2);

			// 3. Trigger Auto-Scroll after short delay to allow DOM to settle
			setTimeout(() => {
				const current = scrollContainer.querySelector(".current-fixture");
				if (current) {
					current.scrollIntoView({ behavior: "smooth", block: "start" });
				}
			}, 1000);

			return outerWrapper;
		}

		// Fallback for Group Stage or non-tournament leagues
		const table = document.createElement("table");
		table.className = "wc-fixtures-table-v2";
		const thead = document.createElement("thead");
		const headerRow = document.createElement("tr");
		columnNames = [
			"Date",
			"Time",
			"Home Team",
			"Home Logo",
			"Score",
			"Away Logo",
			"Away Team",
			"Location"
		];
		columnNames.forEach((col) => {
			const th = document.createElement("th");
			th.textContent = col;
			th.className = `fixture-header-${col.toLowerCase().replace(/\s+/g, "-")}`;
			headerRow.appendChild(th);
		});
		thead.appendChild(headerRow);
		table.appendChild(thead);

		const tbody = document.createElement("tbody");
		fixtures.forEach((fix) => {
			const row = document.createElement("tr");
			row.className = "fixture-row-v2";

			// Task: Color indicators for live, finished and upcoming fixtures
			if (fix.live) {
				row.classList.add("live");
			} else if (
				fix.status === "FT" ||
				fix.status === "AET" ||
				fix.status === "PEN" ||
				fix.status === "PENS"
			) {
				row.classList.add("finished");
			} else {
				row.classList.add("upcoming");
			}

			if (
				this._isHighlightedTeam(fix.homeTeam) ||
				this._isHighlightedTeam(fix.awayTeam)
			) {
				row.classList.add("highlighted");
			}

			this._buildFixtureRowContent(row, fix, columnNames);
			tbody.appendChild(row);
		});
		table.appendChild(tbody);
		outerWrapper.appendChild(table);
		return outerWrapper;
	},

	// Helper to build the content of a fixture row
	_buildFixtureRowContent(row, fix, columnNames) {
		columnNames.forEach((col) => {
			const cell = document.createElement("td");

			if (col === "Date") {
				cell.className = "fixture-date-v2";
				if (fix.timestamp) {
					cell.textContent = moment(fix.timestamp).format("ddd DD MMM");
				} else if (fix.date) {
					cell.textContent = moment(fix.date, "YYYY-MM-DD").format(
						"ddd DD MMM"
					);
				} else {
					cell.textContent = "";
				}
			} else if (col === "Time") {
				cell.className = "fixture-time-v2";

				// Time column is always blank - time is shown in Score column for upcoming matches
				// This prevents redundancy and follows the new design pattern
				cell.textContent = "";
			} else if (col === "Home Team") {
				cell.className = "fixture-home-team-v2";
				cell.textContent = this.translateTeamName(fix.homeTeam);
			} else if (col === "Home Logo") {
				cell.className = "fixture-home-logo-v2";
				const logoPath = fix.homeLogo;
				if (logoPath) {
					const img = document.createElement("img");
					img.className = "fixture-logo-v2";
					this.setupImageLazyLoading(img, logoPath);
					img.onerror = () => (img.style.display = "none");
					cell.appendChild(img);
				}
			} else if (col === "Score") {
				cell.className = "fixture-score-v2";
				const scoreWrapper = document.createElement("div");
				scoreWrapper.className = "score-wrapper-v2";
				const mainScore = document.createElement("div");
				mainScore.className = "main-score-v2";
				if (fix.live) mainScore.classList.add("bright");

				// Determine if fixture is upcoming (not played yet) or live/finished
				// FIX: More robust upcoming detection with multiple checks
				const status = (fix.status || "").toUpperCase();
				const todayDateStr = this.getCurrentDateString();
				const isFinished =
					status === "FT" ||
					status === "AET" ||
					status === "PEN" ||
					status === "PENS" ||
					// BBC sometimes omits FT status - treat past-date, non-live fixtures as finished.
					(!status && !fix.live && fix.date && fix.date < todayDateStr);
				const isLive = fix.live === true || /\d+'|HT|LIVE/i.test(status);

				// A fixture is upcoming if ALL of the following are true:
				// 1. NOT live (no live flag and no live status)
				// 2. NOT finished (no FT/AET/PEN status)
				// 3. Either has no scores OR has aggregate score but no actual match score
				const hasMatchScore =
					fix.homeScore !== undefined && fix.awayScore !== undefined;
				const isUpcoming = !isLive && !isFinished;

				// Additional safety: if fixture has time but no status, it's definitely upcoming
				const hasKickoffTime =
					fix.time && fix.time !== "vs" && /\d{1,2}:\d{2}/.test(fix.time);
				const definitelyUpcoming =
					hasKickoffTime && !status && !hasMatchScore && !isFinished;

				// DEBUG: Log ALL fixtures to diagnose issues
				if (this.config.debug) {
					Log.info(
						`[FIXTURE-DISPLAY] "${fix.homeTeam}" vs "${fix.awayTeam}" | date=${fix.date} | time=${fix.time} | live=${fix.live} | status="${fix.status || "none"}" | score="${fix.score || "none"}" | homeScore=${fix.homeScore} | awayScore=${fix.awayScore} | hasMatchScore=${hasMatchScore} | isUpcoming=${isUpcoming} | isLive=${isLive} | isFinished=${isFinished} | aggregateScore="${fix.aggregateScore || "none"}"`
					);
				}

				let scoreText = "";

				// For upcoming fixtures: ALWAYS show kickoff time (never scores)
				if (isUpcoming || definitelyUpcoming) {
					scoreText = fix.time || "TBD";
					if (this.config.debug) {
						Log.info(
							`[FIXTURE-DISPLAY] Upcoming fixture - showing time: "${scoreText}"`
						);
					}
				}
				// For live fixtures: show current match score
				else if (isLive) {
					// Use match score if available, otherwise default to "0 - 0"
					if (hasMatchScore) {
						scoreText = `${fix.homeScore} - ${fix.awayScore}`;
					} else {
						scoreText = fix.score || "0 - 0";
					}
					if (this.config.debug) {
						Log.info(
							`[FIXTURE-DISPLAY] Live fixture - showing score: "${scoreText}"`
						);
					}
				}
				// For finished fixtures: show final score
				else if (isFinished) {
					if (hasMatchScore) {
						scoreText = `${fix.homeScore} - ${fix.awayScore}`;
					} else {
						scoreText = fix.score || "vs";
					}
					if (this.config.debug) {
						Log.info(
							`[FIXTURE-DISPLAY] Finished fixture - showing score: "${scoreText}"`
						);
					}
				}
				// Fallback: if we can't determine state, prefer time over score
				else {
					if (hasKickoffTime) {
						scoreText = fix.time;
						if (this.config.debug) {
							Log.info(
								`[FIXTURE-DISPLAY] Unknown state but has time - showing time: "${scoreText}"`
							);
						}
					} else {
						scoreText = fix.score || "vs";
						if (this.config.debug) {
							Log.info(
								`[FIXTURE-DISPLAY] Unknown state - showing score: "${scoreText}"`
							);
						}
					}
				}

				mainScore.textContent = scoreText;
				scoreWrapper.appendChild(mainScore);

				// Show status (FT, HT, 85', etc) below the score if live or finished
				// FIX: NEVER show status for upcoming fixtures (even if status field is set by mistake)
				if (fix.status && !isUpcoming && !definitelyUpcoming) {
					const statusDiv = document.createElement("div");
					statusDiv.className = "fixture-status-tag-v2";
					if (isLive) statusDiv.classList.add("live-tag");

					// Format live minutes as "90+x" if over 90 minutes
					let displayStatus = fix.status;
					const minuteMatch = fix.status.match(/^(\d+)'$/);
					if (minuteMatch) {
						const minutes = parseInt(minuteMatch[1]);
						if (minutes > 90) {
							displayStatus = `90+${minutes - 90}'`;
						}
					}
					statusDiv.textContent = displayStatus;
					scoreWrapper.appendChild(statusDiv);
					if (this.config.debug) {
						Log.info(
							`[FIXTURE-DISPLAY] Showing status tag: "${displayStatus}"`
						);
					}
				} else if (isUpcoming || definitelyUpcoming) {
					if (this.config.debug) {
						Log.info(`[FIXTURE-DISPLAY] Upcoming fixture - NOT showing status`);
					}
				}

				// FIX: Show aggregate score for second leg fixtures in brackets below the time/score
				// For upcoming second leg fixtures: shows below the kickoff time
				// For live/finished second leg: shows below the current match score
				if (fix.aggregateScore) {
					const aggScore = document.createElement("div");
					aggScore.className = "aggregate-score-v2";

					// For upcoming fixtures, make aggregate score more prominent
					if (isUpcoming) {
						aggScore.classList.add("upcoming-agg");
					}

					aggScore.textContent = `(agg ${fix.aggregateScore})`;
					scoreWrapper.appendChild(aggScore);
				}
				// Fallback: If fixture is marked as second leg but aggregateScore is missing,
				// try to calculate it from first leg data if available
				else if (fix.isSecondLeg && fix.firstLegFixture) {
					const firstLeg = fix.firstLegFixture;
					if (
						firstLeg.homeScore !== undefined &&
						firstLeg.awayScore !== undefined
					) {
						const aggScore = document.createElement("div");
						aggScore.className = "aggregate-score-v2";
						if (isUpcoming) {
							aggScore.classList.add("upcoming-agg");
						}
						// First leg score reversed for aggregate (away team becomes home in 2nd leg)
						aggScore.textContent = `(agg ${firstLeg.awayScore}-${firstLeg.homeScore})`;
						scoreWrapper.appendChild(aggScore);
					}
				}
				cell.appendChild(scoreWrapper);
			} else if (col === "Away Team") {
				cell.className = "fixture-away-team-v2";
				cell.textContent = this.translateTeamName(fix.awayTeam);
			} else if (col === "Away Logo") {
				cell.className = "fixture-away-logo-v2";
				const logoPath = fix.awayLogo;
				if (logoPath) {
					const img = document.createElement("img");
					img.className = "fixture-logo-v2";
					this.setupImageLazyLoading(img, logoPath);
					img.onerror = () => (img.style.display = "none");
					cell.appendChild(img);
				}
			} else if (col === "Venue" || col === "Location") {
				cell.className = "fixture-location-v2";
				cell.textContent = fix.venue || "";
			}

			row.appendChild(cell);
		});
	},

	translateStage(stage) {
		const map = {
			Playoff: this.translate("PLAYOFF"),
			Rd32: this.translate("ROUND_OF_32"),
			Rd16: this.translate("ROUND_OF_16"),
			QF: this.translate("QUARTER_FINAL"),
			SF: this.translate("SEMI_FINAL"),
			TP: this.translate("THIRD_PLACE"),
			Final: this.translate("FINAL")
		};
		return map[stage] || stage;
	},

	// ===== NEW: Add Flag and Name to Cell =====
	addFlagAndNameToCell(cell, teamName, isHome, logoPath = null) {
		const flagSpan = document.createElement("span");
		flagSpan.className = "country-flag";

		const finalLogoPath = logoPath;

		if (finalLogoPath) {
			const img = document.createElement("img");
			img.className = "inline-flag";
			img.decoding = "async";
			img.width = 14; // stabilize layout
			img.height = 10;
			this.setupImageLazyLoading(img, finalLogoPath);
			img.onerror = () => (img.style.display = "none");
			flagSpan.appendChild(img);
		}

		const nameSpan = document.createElement("span");
		nameSpan.className = "fixture-team-name";
		nameSpan.textContent = this.translateTeamName(teamName);

		if (isHome) {
			// For home team: [Name] [Flag]
			cell.appendChild(nameSpan);
			cell.appendChild(flagSpan);
		} else {
			// For away team: [Flag] [Name]
			cell.appendChild(flagSpan);
			cell.appendChild(nameSpan);
		}
	},

	// Automatically focus on the most relevant sub-tab (live or upcoming matches)
	_autoFocusRelevantSubTab(leagueCode) {
		const data = this.getRenderLeagueData(leagueCode);
		if (!data) return;

		// Only apply to World Cup and UEFA competitions
		const isTournament = this.usesTournamentView(leagueCode);
		if (!isTournament) return;

		// 1. Check for LIVE matches across all knockout stages
		if (data.knockouts) {
			for (const [stage, fixtures] of Object.entries(data.knockouts)) {
				if (fixtures && fixtures.some((f) => f.live)) {
					const stageIdMap = {
						rd32: "Rd32",
						rd16: "Rd16",
						qf: "QF",
						sf: "SF",
						tp: "TP",
						final: "Final",
						playoff: "Playoff"
					};
					const targetTab = stageIdMap[stage] || stage;
					if (this.currentSubTab !== targetTab) {
						if (this.config.debug) {
							Log.info(
								` MMM-SoccerStandings: Auto-focusing LIVE knockout stage: ${targetTab}`
							);
						}
						this.currentSubTab = targetTab;
						return;
					}
				}
			}
		}

		// 2. Check for LIVE matches in World Cup Groups
		if (this.isWorldCupLeague(leagueCode) && data.fixtures) {
			const liveGroupMatch = data.fixtures.find(
				(f) => f.stage === "GS" && f.live && f.group
			);
			if (liveGroupMatch) {
				if (this.currentSubTab !== liveGroupMatch.group) {
					if (this.config.debug) {
						Log.info(
							` MMM-SoccerStandings: Auto-focusing LIVE Group: ${liveGroupMatch.group}`
						);
					}
					this.currentSubTab = liveGroupMatch.group;
					return;
				}
			}
		}

		// Only LIVE matches should trigger auto-focus; otherwise keep the first tab.
	},

	// Adds horizontal scroll indicators (arrows) to a container
	_addHorizontalScrollIndicators(container, parent) {
		if (!container || !parent) return;

		const wrapper = document.createElement("div");
		wrapper.className = "league-tabs-wrapper";

		const prevBtn = document.createElement("button");
		prevBtn.className = "tab-scroll-btn prev";
		prevBtn.appendChild(this.createIcon("fas fa-chevron-left"));
		prevBtn.setAttribute("aria-label", "Scroll tabs left");

		const nextBtn = document.createElement("button");
		nextBtn.className = "tab-scroll-btn next";
		nextBtn.appendChild(this.createIcon("fas fa-chevron-right"));
		nextBtn.setAttribute("aria-label", "Scroll tabs right");

		const updateArrows = () => {
			if (!container) return;
			const { scrollLeft, scrollWidth, clientWidth } = container;
			// Show prev if we've scrolled right at all
			if (scrollLeft > 5) {
				prevBtn.classList.add("visible");
			} else {
				prevBtn.classList.remove("visible");
			}
			// Show next if there's more content to the right
			if (
				scrollLeft < scrollWidth - clientWidth - 5 &&
				scrollWidth > clientWidth
			) {
				nextBtn.classList.add("visible");
			} else {
				nextBtn.classList.remove("visible");
			}
		};

		prevBtn.addEventListener("click", (e) => {
			e.preventDefault();
			e.stopPropagation();
			container.scrollBy({ left: -120, behavior: "smooth" });
		});

		nextBtn.addEventListener("click", (e) => {
			e.preventDefault();
			e.stopPropagation();
			container.scrollBy({ left: 120, behavior: "smooth" });
		});

		container.addEventListener("scroll", updateArrows);

		// Initial check after a short delay to allow for DOM rendering
		setTimeout(updateArrows, 300);

		wrapper.appendChild(prevBtn);
		wrapper.appendChild(container);
		wrapper.appendChild(nextBtn);
		parent.appendChild(wrapper);

		// Re-check on window resize
		const resizeHandler = () => updateArrows();
		window.addEventListener("resize", resizeHandler);

		// Clean up listener when module is destroyed (if MM supported it better)
		// For now we just add it.
	},

	// Return the list of CSS files to load for this module
	getStyles() {
		return ["font-awesome.css", "MMM-SoccerStandings.css"];
	},

	// Helper to translate team names if they exist in translation files
	translateTeamName(name) {
		if (!name) return "";

		// Standardize key: uppercase and underscores for spaces
		const key = name.toUpperCase().replace(/\s+/g, "_");
		const translated = this.translate(key);

		// If translate returns the key (meaning no translation found), return original name
		// In MagicMirror, this.translate(key) returns key if not found
		return translated === key ? name : translated;
	},

	// Get translations
	getTranslations() {
		return {
			af: "translations/af.json",
			ar: "translations/ar.json",
			de: "translations/de.json",
			en: "translations/en.json",
			es: "translations/es.json",
			fa: "translations/fa.json",
			fr: "translations/fr.json",
			ga: "translations/ga.json",
			gd: "translations/gd.json",
			hr: "translations/hr.json",
			ht: "translations/ht.json",
			it: "translations/it.json",
			ja: "translations/ja.json",
			ko: "translations/ko.json",
			mi: "translations/mi.json",
			nl: "translations/nl.json",
			no: "translations/no.json",
			pt: "translations/pt.json",
			uz: "translations/uz.json",
			cy: "translations/cy.json",
			sv: "translations/sv.json",
			pl: "translations/pl.json",
			tr: "translations/tr.json",
			hu: "translations/hu.json",
			uk: "translations/uk.json",
			el: "translations/el.json",
			da: "translations/da.json",
			cs: "translations/cs.json",
			fi: "translations/fi.json",
			ro: "translations/ro.json",
			sk: "translations/sk.json",
			sl: "translations/sl.json",
			sq: "translations/sq.json",
			sr: "translations/sr.json"
		};
	},

	// -----------------------------
	// Theme Overrides
	// -----------------------------
	_applyThemeOverrides() {
		const styleId = "mmm-soccer-standings-theme-override";
		let styleEl = document.getElementById(styleId);

		// Remove existing style element if no overrides are active
		if (
			this.config.darkMode === null &&
			this.config.fontColorOverride === null &&
			this.config.opacityOverride === null &&
			this.config.firstPlaceColor === "rgba(255, 255, 255, 0.1)" &&
			this.config.highlightedColor === "rgba(255, 255, 255, 0.1)"
		) {
			if (styleEl) styleEl.remove();
			return;
		}

		// Create style element if it doesn't exist
		if (!styleEl) {
			styleEl = document.createElement("style");
			styleEl.id = styleId;
			document.head.appendChild(styleEl);
		}

		// Build CSS rules
		let css = "";

		// Dark/Light mode override
		if (this.config.darkMode === true) {
			css +=
				".soccer-standings { background-color: #111 !important; color: #fff !important; }\n";
		} else if (this.config.darkMode === false) {
			css +=
				".soccer-standings { background-color: #f5f5f5 !important; color: #000 !important; }\n";
		}

		// Font color override
		if (this.config.fontColorOverride) {
			// css += `.soccer-standings * { color: ${this.config.fontColorOverride} !important; }\n`;
		}

		// Opacity override (exclude back-to-top-controls which manages its own visibility)
		if (
			this.config.opacityOverride !== null &&
			this.config.opacityOverride !== undefined
		) {
			const opacity = parseFloat(this.config.opacityOverride);
			if (!isNaN(opacity)) {
				css += `.soccer-standings * { opacity: ${opacity} !important; }\n`;
				// Restore back-to-top-controls opacity to allow visibility toggle to work
				css +=
					".soccer-standings .back-to-top-controls { opacity: 0 !important; }\n";
				css +=
					".soccer-standings .back-to-top-controls.visible { opacity: 1 !important; }\n";
			}
		}

		// Highlight colors
		if (this.config.firstPlaceColor) {
			css += `.soccer-standings .team-row:first-child { background-color: ${this.config.firstPlaceColor} !important; }\n`;
			css += `.soccer-standings .team-row:first-child .position-cell { background: ${this.config.firstPlaceColor} !important; }\n`;
		}
		if (this.config.highlightedColor) {
			css += `.soccer-standings .team-row.highlighted { background-color: ${this.config.highlightedColor} !important; }\n`;
			css += `.soccer-standings .fixture-row-v2.highlighted { background-color: ${this.config.highlightedColor} !important; }\n`;
		}

		styleEl.textContent = css;
	},

	/**
	 * Creates the toggle icon for hiding/showing the league table
	 * @returns {HTMLElement} The toggle icon element
	 */
	_createToggleIcon() {
		const toggleIcon = document.createElement("div");
		toggleIcon.className = "LeagueTable-toggle-icon visible"; // Always visible in footer
		toggleIcon.title = this.isContentHidden
			? this.translate("SHOW_LEAGUE_TABLE")
			: this.translate("HIDE_LEAGUE_TABLE");

		// Use FontAwesome icon for consistency (DES-01)
		const iconClass = this.isContentHidden
			? "fas fa-chevron-up"
			: "fas fa-chevron-down";
		const icon = this.createIcon(iconClass);
		toggleIcon.appendChild(icon);
		toggleIcon.style.cursor = "pointer";
		toggleIcon.style.fontSize = "14px";
		toggleIcon.style.color = "#888";
		toggleIcon.style.padding = "0 10px";
		toggleIcon.style.transition = "transform 0.3s ease";

		toggleIcon.onclick = (e) => {
			e.stopPropagation();
			this.isContentHidden = !this.isContentHidden;
			this.updateDom();
		};

		return toggleIcon;
	}
});
