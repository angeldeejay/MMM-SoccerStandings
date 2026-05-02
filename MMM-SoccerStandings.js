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
    maxTeams: 12, // 0 = show all teams
    highlightTeams: ["Celtic", "Hearts"], // Emphasize teams by exact name
    // ===== League Selection =====
    // Use selectedLeagues to choose leagues by espn_service slug.
    // Example: selectedLeagues: ["uefa.champions", "fifa.world"]
    selectedLeagues: ["uefa.champions"],

    // ===== Display Options =====
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
    formMaxGames: 3, // Max number of form games to display (clamped to 1..5)
    enhancedIndicatorShapes: true, // true = shape differentiation on form tokens (circle/square/triangle); false = no background, colored text only (W=green, D=grey, L=red)

    // ===== UX Options (Phase 4) =====
    tableDensity: "normal", // Table row density: "compact", "normal", "comfortable"
    marqueePageSize: 3, // Maximum fixtures visible per marquee page before vertical scrolling kicks in
    marqueePageInterval: 3, // Seconds to wait on each visible marquee page before scrolling
    // ===== Theme Options (Phase 4) =====
    theme: "auto", // Color theme: "auto" (follows system), "light", "dark"

    // ===== Cycling options =====
    cycle: true, // Enable cycling through leagues and visible subtabs
    cycleInterval: 15 * 1000, // Time to display each cycle step (league or subtab)

    // Theme overrides
    darkMode: null, // null=auto, true=force dark, false=force light
    provider: "espn_service", // Default product provider for the active canonical runtime path
    providerSettings: {
      espn_service: {
        baseUrl: "http://localhost:28000",
        timeoutMs: 8000
      }
    },

    // Cache controls
    clearCacheButton: true,
    clearCacheOnStart: false // Set to true to force-clear ALL caches (disk, fixture, logo) on every module start - useful for development and troubleshooting
  },

  // Required version of MagicMirror
  requiresVersion: "2.1.0",

  // Module startup
  start() {
    Log.info(`Starting module: ${this.name}`);
    this.config = {
      ...this.config,
      showPosition: true,
      autoFocusRelevantSubTab: false,
      fixtureDateFilter: null,
      customTeamColors: null,
      fontColorOverride: null,
      opacityOverride: null,
      debug: false,
      dateTimeOverride: null,
      leagueHeaders: null
    };
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
          ) || this.normalizeLeagueCode(this.defaults.selectedLeagues[0]);

    this.currentSubTab = this.getDefaultCompetitionSubTab(this.currentLeague);

    this.isScrolling = false;
    this.isContentHidden = false; // Add state for content visibility
    this._pinned = false; // when true, temporarily lock view and pause auto-cycling
    this._countdownEl = null; // header countdown element
    this._countdownTimer = null;
    this._fixtureMarqueeBindings = [];
    this._lastRenderedWrapper = null;
    this._postRenderEnhancementsTimer = null;

    if (this.config.debug) {
      Log.info(
        ` MMM-SoccerStandings: Enabled leagues: ${JSON.stringify(this.enabledLeagueCodes)}`
      );
      Log.info(` MMM-SoccerStandings: Current league: ${this.currentLeague}`);
    }

    // Optionally clear cache once at startup
    if (this.config.clearCacheOnStart === true) {
      this.sendSocketNotification("CACHE_CLEAR_ALL");
    }

    // Send initial request for data for all enabled leagues
    this.requestAllLeagueData();

    // Set up periodic updates
    this.scheduleUpdate();

    // Set up cycling if enabled
    if (this.isCycleEnabled()) {
      this.scheduleCycling();
    }
  },

  /**
   * Gets the current date.
   * @returns {Date} The current date
   */
  getCurrentDate() {
    return new Date();
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
          ) || this.normalizeLeagueCode(this.defaults.selectedLeagues[0]);
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
      return normalizedValue.includes(".")
        ? normalizedValue.toLowerCase()
        : null;
    }

    const competitionKey = this.resolveCompetitionKey(
      normalizedValue,
      providerId
    );
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

    const competitionKey = this.resolveCompetitionKey(
      normalizedValue,
      providerId
    );
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

  getCanonicalCompetitionPayload(leagueCode) {
    const canonicalDataKey = this.getCanonicalDataKey(leagueCode);
    return canonicalDataKey && this.canonicalData
      ? this.canonicalData[canonicalDataKey] || null
      : null;
  },

  getCanonicalCompetitionNavigation(leagueCode) {
    const canonicalPayload = this.getCanonicalCompetitionPayload(leagueCode);
    const navigation =
      canonicalPayload &&
      canonicalPayload.competition &&
      canonicalPayload.competition.navigation;

    return navigation && Array.isArray(navigation.subTabs) ? navigation : null;
  },

  getCanonicalCompetitionSubTabs(leagueCode) {
    const navigation = this.getCanonicalCompetitionNavigation(leagueCode);
    return navigation ? navigation.subTabs : [];
  },

  getCanonicalCompetitionSubTab(leagueCode, subTabId) {
    if (!subTabId) {
      return null;
    }

    return this.getCanonicalCompetitionSubTabs(leagueCode).find(
      (subTab) => subTab && subTab.id === subTabId
    );
  },

  getCompetitionSubTabRuntimeId(leagueCode, subTabId) {
    const canonicalSubTab = this.getCanonicalCompetitionSubTab(
      leagueCode,
      subTabId
    );
    if (!canonicalSubTab) {
      return subTabId;
    }

    if (canonicalSubTab.type !== "phase") {
      return canonicalSubTab.id || subTabId;
    }

    if (
      !this.isWorldCupLeague(leagueCode) &&
      !this.isUEFATournamentLeague(leagueCode)
    ) {
      return canonicalSubTab.id || subTabId;
    }

    const stageText = String(
      canonicalSubTab.phaseLabel ||
        canonicalSubTab.label ||
        canonicalSubTab.id ||
        ""
    )
      .trim()
      .toLowerCase()
      .replace(/[_-]+/g, " ");
    const stageSlug = String(
      canonicalSubTab.phaseSlug || canonicalSubTab.id || ""
    )
      .trim()
      .toLowerCase();

    // Standings/table phase — UCL/UEL/UECL "League Phase" maps to the Table tab.
    if (/league.phase/.test(stageSlug) || /league phase/.test(stageText)) {
      return "Table";
    }
    // Group stage (WC2026) — groups are handled as individual letter tabs,
    // but the phase itself maps to the GS sentinel if ever needed directly.
    if (stageSlug === "group-stage" || /^group stage$/.test(stageText)) {
      return "GS";
    }
    if (
      /round of 32/.test(stageText) ||
      /round-of-32/.test(stageSlug) ||
      /rd32/.test(stageSlug)
    ) {
      return "Rd32";
    }
    if (
      /round of 16/.test(stageText) ||
      /round-of-16/.test(stageSlug) ||
      /rd16/.test(stageSlug)
    ) {
      return "Rd16";
    }
    if (
      /quarterfinal/.test(stageText) ||
      /quarter-final/.test(stageText) ||
      /\bqf\b/.test(stageSlug)
    ) {
      return "QF";
    }
    if (
      /semifinal/.test(stageText) ||
      /semi-final/.test(stageText) ||
      /\bsf\b/.test(stageSlug)
    ) {
      return "SF";
    }
    if (
      /third place/.test(stageText) ||
      /3rd.place/.test(stageText) ||
      /3rd.place/.test(stageSlug) ||
      /\btp\b/.test(stageSlug)
    ) {
      return "TP";
    }
    if (
      /playoff/.test(stageText) ||
      /knockout.round.playoff/.test(stageSlug) ||
      /playoff/.test(stageSlug)
    ) {
      return "Playoff";
    }
    if (/\bfinal\b/.test(stageText) || stageSlug === "final") {
      return "Final";
    }

    return canonicalSubTab.id || subTabId;
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

    const tokens = leagueName.trim().split(/\s+/).filter(Boolean);
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
    const competitionKey = this.resolveCompetitionKey(
      leagueCode,
      "espn_service"
    );
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

  getVisibleCompetitionSubTabs(leagueCode) {
    // Prefer canonical navigation from the API catalog when available.
    // Falls back to the static Table/Fixtures pair for leagues without catalog data.
    const canonicalSubTabs = this.getCanonicalCompetitionSubTabs(leagueCode);
    if (canonicalSubTabs.length > 0) {
      return canonicalSubTabs.map((subTab) => subTab.id).filter(Boolean);
    }

    return this.getCompetitionSubTabs(leagueCode);
  },

  getCompetitionSubTabLabel(leagueCode, subTabId) {
    const canonicalSubTab = this.getCanonicalCompetitionSubTab(
      leagueCode,
      subTabId
    );
    if (canonicalSubTab && canonicalSubTab.label) {
      return canonicalSubTab.label;
    }

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
    const canonicalSubTab = this.getCanonicalCompetitionSubTab(
      leagueCode,
      subTabId
    );
    if (canonicalSubTab) {
      if (canonicalSubTab.type === "group") {
        return `Show ${canonicalSubTab.label} standings`;
      }

      return `Show ${canonicalSubTab.label} fixtures`;
    }

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
    const availableSubTabs = this.getVisibleCompetitionSubTabs(leagueCode);
    if (!availableSubTabs.length) {
      this.currentSubTab = null;
      return;
    }

    if (!availableSubTabs.includes(this.currentSubTab)) {
      this.currentSubTab = availableSubTabs[0];
    }
  },

  shouldShowLeagueButtons() {
    return (
      Array.isArray(this.enabledLeagueCodes) &&
      this.enabledLeagueCodes.length > 1
    );
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
      ? currentData.fixtures.filter(
          (fixture) => fixture && fixture.stage === subTab
        )
      : [];
  },

  getDefaultCompetitionSubTab(leagueCode) {
    const subTabs = this.getVisibleCompetitionSubTabs(leagueCode);
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
            provider: this.config.provider,
            providerSettings: {
              espn_service: {
                baseUrl: espnApiConfig.baseUrl,
                timeoutMs: espnApiConfig.timeoutMs
              }
            },
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
   * Reads exclusively from providerSettings[provider].
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
      typeof providerSettings.baseUrl === "string" &&
      providerSettings.baseUrl.trim()
        ? providerSettings.baseUrl.trim().replace(/\/+$/, "")
        : "";
    const timeoutMs =
      Number.isFinite(providerSettings.timeoutMs) &&
      providerSettings.timeoutMs > 0
        ? Number(providerSettings.timeoutMs)
        : 8000;

    return { baseUrl, timeoutMs };
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
    const text = document.createTextNode(
      " " + this.translate("OFFLINE_MODE_CACHED")
    );

    offlineIndicator.appendChild(icon);
    offlineIndicator.appendChild(text);

    return offlineIndicator;
  },

  // Utility: determine if a WC stage is complete based on available data
  isWorldCupStageComplete(stageId) {
    const data = this.getRenderLeagueData(
      this.getPreferredWorldCupLeagueCode()
    );
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
    return list.every((f) => this.getFixtureStateFlags(f).isFinished);
  },

  getNextCycleTarget() {
    const leagues = Array.isArray(this.enabledLeagueCodes)
      ? this.enabledLeagueCodes
      : [];
    if (!leagues.length) {
      return null;
    }

    let currentLeagueIndex = leagues.indexOf(this.currentLeague);
    if (currentLeagueIndex === -1) {
      currentLeagueIndex = 0;
    }

    const currentLeague = leagues[currentLeagueIndex];
    const visibleSubTabs = this.getVisibleCompetitionSubTabs(currentLeague);
    const currentSubTab = visibleSubTabs.includes(this.currentSubTab)
      ? this.currentSubTab
      : visibleSubTabs[0] || null;

    if (leagues.length === 1) {
      if (visibleSubTabs.length <= 1) {
        return null;
      }

      const nextSubTabIndex =
        (visibleSubTabs.indexOf(currentSubTab) + 1) % visibleSubTabs.length;
      return {
        league: currentLeague,
        subTab: visibleSubTabs[nextSubTabIndex],
        type: "SUB_TAB"
      };
    }

    if (visibleSubTabs.length > 1) {
      const currentSubTabIndex = visibleSubTabs.indexOf(currentSubTab);
      if (
        currentSubTabIndex !== -1 &&
        currentSubTabIndex < visibleSubTabs.length - 1
      ) {
        return {
          league: currentLeague,
          subTab: visibleSubTabs[currentSubTabIndex + 1],
          type: "SUB_TAB"
        };
      }
    }

    const nextLeagueIndex = (currentLeagueIndex + 1) % leagues.length;
    const nextLeague = leagues[nextLeagueIndex];
    return {
      league: nextLeague,
      subTab: this.getDefaultCompetitionSubTab(nextLeague),
      type: "LEAGUE"
    };
  },

  isCycleEnabled() {
    return this.config.cycle !== false;
  },

  // Set up cycling between leagues and visible subtabs with a single timer
  scheduleCycling() {
    if (!this.isCycleEnabled()) return;
    if (this._pinned) return; // respect pin state

    // Clear any existing timer
    if (this.cycleTimer) {
      clearInterval(this.cycleTimer);
      this.cycleTimer = null;
    }

    const nextTarget = this.getNextCycleTarget();
    if (!nextTarget) {
      if (this.config.debug) {
        Log.info(
          " MMM-SoccerStandings: Cycling not enabled - only one visible target"
        );
      }
      return;
    }

    const cycleFn = () => {
      const target = this.getNextCycleTarget();
      if (!target) {
        this._pauseCycling();
        return;
      }

      if (this.config.debug) {
        Log.info(
          ` MMM-SoccerStandings: Cycling to ${target.league} / ${target.subTab || "none"}`
        );
      }

      this.currentLeague = target.league;
      this.currentSubTab = target.subTab;
      this.updateDom();
    };

    const interval = this.config.cycleInterval;
    this.cycleTimer = setInterval(cycleFn, interval);

    if (this.config.debug) {
      Log.info(
        ` MMM-SoccerStandings: Cycling enabled with interval ${interval / 1000} seconds`
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

    const leagueName = this.getLeagueDisplayName(
      competitionSlug || competitionCode
    );
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
    const rawStatus = String(fix.status || "").trim();
    const status = rawStatus.toUpperCase();
    const canonicalStatus = rawStatus.toLowerCase();
    const todayDateStr = this.getCurrentDateString();
    const isFinished =
      status === "FT" ||
      status === "AET" ||
      status === "PEN" ||
      status === "PENS" ||
      canonicalStatus === "final" ||
      (!status && !fix.live && fix.date && fix.date < todayDateStr);
    const isLive =
      fix.live === true ||
      canonicalStatus === "in_progress" ||
      /\d+'|HT|LIVE/i.test(status);
    const isNonStarted =
      status === "PST" ||
      status === "CANC" ||
      canonicalStatus === "scheduled" ||
      canonicalStatus === "postponed" ||
      canonicalStatus === "cancelled";
    const isUpcoming = isNonStarted || (!isLive && !isFinished);

    return { isFinished, isLive, isUpcoming };
  },

  getMarqueePageSize() {
    const value = Number(this.config.marqueePageSize);
    if (!Number.isFinite(value) || value <= 0) {
      return null;
    }

    return Math.max(1, Math.floor(value));
  },

  getMarqueePageIntervalMs() {
    const value = Number(this.config.marqueePageInterval);
    if (!Number.isFinite(value) || value <= 0) {
      return null;
    }

    return Math.max(1000, Math.round(value * 1000));
  },

  shouldEnableFixtureMarquee(fixturesCount) {
    const pageSize = this.getMarqueePageSize();
    const intervalMs = this.getMarqueePageIntervalMs();
    return Boolean(pageSize && intervalMs && Number(fixturesCount) > pageSize);
  },

  getFixtureMarqueeViewportHeight() {
    const pageSize = this.getMarqueePageSize();
    if (!pageSize) {
      return null;
    }

    return `calc(${pageSize} * var(--mtlt-fixture-card-row-height))`;
  },

  getConfiguredFormGameCount() {
    const fallback = Math.min(
      5,
      Math.max(1, Math.floor(Number(this.defaults.formMaxGames) || 3))
    );
    const value = Number(this.config.formMaxGames);
    if (!Number.isFinite(value)) {
      return fallback;
    }

    return Math.min(5, Math.max(1, Math.floor(value)));
  },

  getFormCountClass(formGames = this.getConfiguredFormGameCount()) {
    return `form-count-${formGames}`;
  },

  getFixtureDateTimeValue(fix) {
    if (!fix || !fix.date) {
      return null;
    }

    const hasKickoffTime =
      typeof fix.time === "string" && /^\d{1,2}:\d{2}$/.test(fix.time.trim());
    const rawValue = hasKickoffTime
      ? `${fix.date}T${fix.time.trim()}:00`
      : fix.date;
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
        const dayGap =
          Math.abs(entry.dateValue - anchor) / (1000 * 60 * 60 * 24);
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

  getMostRecentFixturesFirst(fixtures) {
    return Array.isArray(fixtures) ? fixtures.slice().reverse() : [];
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
      const visibleResults = this.getMostRecentFixturesFirst(results);
      const visibleUpcoming = upcoming;

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
          this.createFixturesTable(visibleResults, false, "desc")
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

    if (
      activeSubTab !== "Fixtures" &&
      currentData.teams &&
      currentData.teams.length > 0
    ) {
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
    const info = this.getLeagueInfo(leagueCode);

    return (
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
        if (this.isCycleEnabled() && this.cycleTimer) {
          this.scheduleCycling();
        }
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

  // Pause all cycling timers
  _pauseCycling() {
    if (this.cycleTimer) {
      clearInterval(this.cycleTimer);
      this.cycleTimer = null;
    }
    this._stopHeaderCountdown();
  },
  // Resume cycling timers if config allows
  _resumeCyclingIfNeeded() {
    if (this.isScrolling || this._pinned) return;
    if (this.isCycleEnabled()) {
      this.scheduleCycling();
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

  getTemplate() {
    return "templates/MMM-SoccerStandings.njk";
  },

  getWrapperClassName() {
    const classes = ["soccer-standings"];
    if (
      this.config.tableDensity &&
      ["compact", "normal", "comfortable"].includes(this.config.tableDensity)
    ) {
      classes.push(`density-${this.config.tableDensity}`);
    }
    if (
      this.config.theme &&
      ["light", "dark", "auto"].includes(this.config.theme)
    ) {
      classes.push(`theme-${this.config.theme}`);
    }
    if (this.isWorldCupLeague(this.currentLeague)) {
      classes.push("league-mode-wc");
    } else if (this.isUEFATournamentLeague(this.currentLeague)) {
      classes.push("league-mode-uefa");
    } else {
      classes.push("league-mode-national");
    }
    return classes.join(" ");
  },

  getCurrentLeagueTitle() {
    let baseTitle = this.getLeagueDisplayName(this.currentLeague);
    const canonicalSubTab = this.currentSubTab
      ? this.getCanonicalCompetitionSubTab(
          this.currentLeague,
          this.currentSubTab
        )
      : null;
    if (this.isWorldCupLeague(this.currentLeague) && this.currentSubTab) {
      let appended = false;
      const stageMap = {
        Rd32: this.translate("ROUND_OF_32"),
        Rd16: this.translate("ROUND_OF_16"),
        QF: this.translate("QUARTER_FINAL"),
        SF: this.translate("SEMI_FINAL"),
        TP: this.translate("THIRD_PLACE"),
        Final: this.translate("FINAL")
      };
      if (/^[A-L]$/.test(this.currentSubTab)) {
        baseTitle += ` • ${this.translate("GROUP")} ${this.currentSubTab}`;
        appended = true;
      } else if (stageMap[this.currentSubTab]) {
        baseTitle += ` • ${stageMap[this.currentSubTab]}`;
        appended = true;
      }
      if (!appended && canonicalSubTab && canonicalSubTab.label) {
        baseTitle += ` • ${canonicalSubTab.label}`;
      }
    } else if (canonicalSubTab && canonicalSubTab.label) {
      baseTitle += ` • ${canonicalSubTab.label}`;
    }
    return baseTitle;
  },

  buildStaleWarningBadgeData(currentData) {
    if (
      !currentData ||
      (!currentData.cacheFallback && !currentData.incomplete)
    ) {
      return null;
    }

    let dataAge = 0;
    let ageColor = "#ffa500";
    let ageSeverity = "medium";
    if (currentData.meta && currentData.meta.lastUpdated) {
      const lastUpdate = new Date(currentData.meta.lastUpdated);
      const now = new Date();
      dataAge = Math.floor((now - lastUpdate) / (1000 * 60));
      if (dataAge < 60) {
        ageColor = "#4CAF50";
        ageSeverity = "fresh";
      } else if (dataAge < 360) {
        ageColor = "#FFC107";
        ageSeverity = "moderate";
      } else {
        ageColor = "#FF5252";
        ageSeverity = "stale";
      }
    }

    if (currentData.cacheFallback) {
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
      return {
        className: "stale-warning xsmall",
        text: ageText,
        title: `Live fetch failed: Showing cached data from ${Math.floor(dataAge / 60)} hours ${dataAge % 60} minutes ago`,
        ariaLabel: ageText.trim(),
        iconClass: "fas fa-history",
        severity: ageSeverity,
        style: `margin-left: 8px; font-weight: bold; padding: 2px 8px; border-radius: 3px; color: ${ageColor}; border: 1px solid ${ageColor};`
      };
    }

    return {
      className: "stale-warning xsmall",
      text: " INCOMPLETE",
      title:
        "Live data missing statistics: Parser may need update or data not yet available",
      ariaLabel: "Incomplete data",
      iconClass: "fas fa-exclamation-circle",
      severity: ageSeverity,
      style: `margin-left: 8px; font-weight: bold; padding: 2px 8px; border-radius: 3px; color: ${ageColor}; border: 1px solid ${ageColor};`
    };
  },

  buildAwaitingSplitBadgeData(currentData) {
    if (!currentData || !currentData.awaitingSplit) {
      return null;
    }

    return {
      className: "awaiting-split-badge xsmall",
      text: ` ${this.translate("AWAITING_SPLIT")}`,
      title:
        "Phase 1 complete - awaiting the league split announcement for Phase 2 groups.",
      ariaLabel: "Awaiting Phase 2 Split",
      iconClass: "fas fa-hourglass-half",
      style:
        "margin-left: 8px; font-weight: bold; padding: 2px 8px; border-radius: 3px; color: #64B5F6; border: 1px solid #64B5F6;"
    };
  },

  buildLeagueTabsTemplateData() {
    if (!this.shouldShowLeagueButtons()) {
      return [];
    }

    return this.enabledLeagueCodes.map((leagueCode) => {
      const normalizedCode = this.normalizeLeagueCode(leagueCode);
      const leagueInfo = this.getLeagueInfo(leagueCode);
      return {
        leagueCode,
        active: this.currentLeague === normalizedCode,
        name: leagueInfo
          ? leagueInfo.name
          : this.getLeagueDisplayName(leagueCode),
        ariaLabel: `Switch to ${leagueInfo ? leagueInfo.name : this.getLeagueDisplayName(leagueCode)} table`,
        abbreviation: this.getLeagueAbbreviation(leagueCode),
        logo: leagueInfo ? leagueInfo.logo : null
      };
    });
  },

  buildSubTabsTemplateData() {
    const visibleSubTabs = this.getVisibleCompetitionSubTabs(
      this.currentLeague
    );
    if (visibleSubTabs.length <= 1) {
      return [];
    }

    this.ensureCurrentSubTab(this.currentLeague);
    return visibleSubTabs.map((subTabId) => ({
      id: subTabId,
      label: this.getCompetitionSubTabLabel(this.currentLeague, subTabId),
      ariaLabel: this.getCompetitionSubTabAriaLabel(
        this.currentLeague,
        subTabId
      ),
      active: this.currentSubTab === subTabId,
      type:
        this.getCanonicalCompetitionSubTab(this.currentLeague, subTabId)
          ?.type || null,
      isKnockoutStage: this.getCanonicalCompetitionSubTab(
        this.currentLeague,
        subTabId
      )?.type
        ? this.getCanonicalCompetitionSubTab(this.currentLeague, subTabId)
            .type === "phase"
        : !["Table", "Fixtures"].includes(subTabId) && !/^[A-L]$/.test(subTabId)
    }));
  },

  buildHeaderActionButtonsData() {
    const buttons = [
      {
        action: "refresh",
        className: "refresh-btn",
        title: "Refresh Data",
        ariaLabel: "Refresh Data",
        iconClass: "fas fa-sync-alt",
        ariaPressed: null
      }
    ];

    if (this.config.clearCacheButton === true) {
      buttons.push({
        action: "clear-cache",
        className: "clear-cache-btn",
        title: "Clear Cache",
        ariaLabel: "Clear Cache",
        iconClass: "fas fa-trash-alt",
        ariaPressed: null
      });
    }

    if (this.isCycleEnabled()) {
      buttons.push({
        action: "toggle-cycle",
        className: `pin-btn${this._pinned ? " active" : ""}`,
        title: this._pinned ? "Resume auto-cycling" : "Pause auto-cycling",
        ariaLabel: this._pinned ? "Resume auto-cycling" : "Pause auto-cycling",
        iconClass: this._pinned ? "fas fa-play" : "fas fa-pause",
        ariaPressed: this._pinned ? "true" : "false"
      });
    }

    return buttons;
  },

  buildShellTemplateData(currentData) {
    const badges = [
      this.buildStaleWarningBadgeData(currentData),
      this.buildAwaitingSplitBadgeData(currentData)
    ].filter(Boolean);
    const countdownStartValue = this.getCycleCountdownStartValue();

    return {
      identifier: this.identifier,
      currentLeague: this.currentLeague,
      wrapperClassName: this.getWrapperClassName(),
      offlineIndicator: this.isOnline
        ? null
        : {
            text: " Offline Mode - Showing Cached Data",
            iconClass: "fas fa-wifi-slash"
          },
      header: {
        title: this.getCurrentLeagueTitle(),
        badges,
        countdown:
          this.isCycleEnabled() && countdownStartValue !== null
            ? this.formatCompactNumber(countdownStartValue)
            : null,
        actionButtons: this.buildHeaderActionButtonsData()
      },
      leagueTabs: this.buildLeagueTabsTemplateData(),
      subTabs: this.buildSubTabsTemplateData()
    };
  },

  getTemplateData() {
    return this.buildShellTemplateData(
      this.getRenderLeagueData(this.currentLeague)
    );
  },

  renderHiddenState(currentData) {
    const hiddenWrapper = document.createElement("div");
    hiddenWrapper.className = "soccer-standings content-hidden";

    const footer = document.createElement("div");
    footer.className = "back-to-top-controls visible";
    footer.style.display = "flex";
    footer.style.justifyContent = "space-between";
    footer.style.alignItems = "center";
    footer.style.width = "100%";
    footer.style.boxSizing = "border-box";

    footer.appendChild(this._createToggleIcon());

    if (currentData) {
      const sourceContainer = this.createSourceInfoElement(currentData);
      if (sourceContainer) {
        footer.appendChild(sourceContainer);
      }
    }

    const spacer = document.createElement("div");
    spacer.style.width = "40px";
    footer.appendChild(spacer);

    hiddenWrapper.appendChild(footer);
    return hiddenWrapper;
  },

  bindChromeInteractions(wrapper) {
    const refreshBtn = wrapper.querySelector('[data-action="refresh"]');
    if (refreshBtn) {
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
    }

    const clearBtn = wrapper.querySelector('[data-action="clear-cache"]');
    if (clearBtn) {
      const clearHandler = () => {
        this.sendSocketNotification("CACHE_CLEAR_ALL");
      };
      clearBtn.addEventListener("click", clearHandler);
      this.addKeyboardNavigation(clearBtn, clearHandler);
    }

    const pinBtn = wrapper.querySelector('[data-action="toggle-cycle"]');
    if (pinBtn) {
      const pinHandler = () => {
        this._pinned = !this._pinned;
        pinBtn.classList.toggle("active", this._pinned);
        pinBtn.setAttribute("aria-pressed", this._pinned ? "true" : "false");
        pinBtn.setAttribute(
          "aria-label",
          this._pinned ? "Resume auto-cycling" : "Pause auto-cycling"
        );
        pinBtn.title = this._pinned
          ? "Resume auto-cycling"
          : "Pause auto-cycling";
        const pinIcon = pinBtn.querySelector("i");
        if (pinIcon) {
          pinIcon.className = this._pinned ? "fas fa-play" : "fas fa-pause";
        }
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
    }

    wrapper.querySelectorAll(".league-btn[data-league]").forEach((button) => {
      button.addEventListener("click", (event) => {
        this.handleLeagueButtonClick(event);
      });
    });

    wrapper.querySelectorAll(".wc-btn[data-subtab]").forEach((button) => {
      const subTabId = button.getAttribute("data-subtab");
      button.addEventListener("click", () => {
        this.currentSubTab = subTabId;
        if (this.isCycleEnabled() && this.cycleTimer) {
          this.scheduleCycling();
        }
        this.updateDom();
      });
    });
  },

  renderContentBody(contentBody, currentData) {
    if (!contentBody) {
      return;
    }

    if (!this.loaded[this.currentLeague] && !this.error) {
      if (this.config.debug) {
        Log.info(
          ` MMM-SoccerStandings: Data not loaded for ${this.currentLeague}. Loaded states: ${JSON.stringify(this.loaded)}`
        );
      }

      if (this.loaded[this.currentLeague] === undefined) {
        if (this.config.debug) {
          Log.warn(
            ` MMM-SoccerStandings: ${this.currentLeague} was not in loaded map, requesting now`
          );
        }
        this.loaded[this.currentLeague] = false;
        this.requestAllLeagueData();
      }

      const leagueDisplayName =
        this.getLeagueDisplayName(this.currentLeague) || this.currentLeague;
      const skeletonLoader = document.createElement("div");
      skeletonLoader.className = "skeleton-loader";
      skeletonLoader.setAttribute("role", "status");
      skeletonLoader.setAttribute(
        "aria-label",
        `Loading ${leagueDisplayName} data`
      );

      const skeletonHeader = document.createElement("div");
      skeletonHeader.className = "skeleton-header";
      const skeletonTitle = document.createElement("div");
      skeletonTitle.className = "skeleton-title";
      skeletonHeader.appendChild(skeletonTitle);
      const skeletonMeta = document.createElement("div");
      skeletonMeta.className = "skeleton-meta";
      skeletonHeader.appendChild(skeletonMeta);
      skeletonLoader.appendChild(skeletonHeader);

      const skeletonTable = document.createElement("div");
      skeletonTable.className = "skeleton-table";
      for (let i = 0; i < 10; i++) {
        const skeletonRow = document.createElement("div");
        skeletonRow.className = "skeleton-row";
        ["position", "logo", "team"].forEach((klass) => {
          const cell = document.createElement("div");
          cell.className = `skeleton-cell ${klass}`;
          skeletonRow.appendChild(cell);
        });
        for (let j = 0; j < 8; j++) {
          const statCell = document.createElement("div");
          statCell.className = "skeleton-cell stat";
          skeletonRow.appendChild(statCell);
        }
        const formCell = document.createElement("div");
        formCell.className = "skeleton-cell form";
        skeletonRow.appendChild(formCell);
        skeletonTable.appendChild(skeletonRow);
      }
      skeletonLoader.appendChild(skeletonTable);

      const loadingText = document.createElement("div");
      loadingText.className = "dimmed xsmall";
      loadingText.style.textAlign = "center";
      loadingText.style.marginTop = "15px";
      loadingText.textContent = `${this.translate("LOADING")} ${leagueDisplayName}...`;
      loadingText.setAttribute("aria-live", "polite");
      skeletonLoader.appendChild(loadingText);

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

      contentBody.appendChild(skeletonLoader);
      contentBody.className += " dimmed light small";
      return;
    }

    if (this.error && this.retryCount > this.config.maxRetries) {
      const errorState = document.createElement("div");
      errorState.className = "error-state dimmed light small";
      errorState.setAttribute("role", "alert");

      const errorIcon = document.createElement("i");
      errorIcon.className = "fas fa-exclamation-triangle error-icon";
      errorIcon.setAttribute("aria-hidden", "true");
      errorState.appendChild(errorIcon);

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
      contentBody.appendChild(errorState);
      return;
    }

    if (this.error && this.retryCount <= this.config.maxRetries) {
      const retryState = document.createElement("div");
      retryState.className = "retry-state dimmed light small";
      const retryIcon = document.createElement("i");
      retryIcon.className = "fas fa-sync fa-spin retry-icon";
      retryState.appendChild(retryIcon);
      const retryText = document.createElement("span");
      retryText.textContent = ` ${this.translate("RETRYING")} (${this.retryCount}/${this.config.maxRetries})...`;
      retryState.appendChild(retryText);
      contentBody.appendChild(retryState);
      return;
    }

    if (currentData) {
      if (this.usesTournamentView(this.currentLeague)) {
        contentBody.appendChild(this.createWorldCupView(currentData));
      } else if (
        this.shouldUseCanonicalFlatSlice(this.currentLeague) &&
        currentData.teams &&
        currentData.fixtures
      ) {
        contentBody.appendChild(this.createFlatLeagueView(currentData));
      } else if (currentData.teams) {
        if (this.config.debug) {
          Log.info(
            ` MMM-SoccerStandings: Creating table for ${this.currentLeague} with ${currentData.teams.length} teams`
          );
        }
        contentBody.appendChild(
          this.createTable(currentData, this.currentLeague)
        );
      } else {
        contentBody.textContent = this.translate("NO_DATA");
        contentBody.className += " dimmed light small";
      }
    } else {
      if (this.config.debug) {
        Log.info(
          ` MMM-SoccerStandings: No league data available for ${this.currentLeague}`
        );
      }
      contentBody.textContent = this.translate("NO_DATA");
      contentBody.className += " dimmed light small";
    }
  },

  populateFooterSource(wrapper, currentData) {
    const footer = wrapper.querySelector('[data-slot="footer"]');
    if (!footer || !currentData) {
      return;
    }

    const sourceContainer = this.createSourceInfoElement(currentData);
    if (sourceContainer) {
      footer.appendChild(sourceContainer);
    }
  },

  schedulePostRenderEnhancements(wrapper) {
    if (this._postRenderEnhancementsTimer) {
      clearTimeout(this._postRenderEnhancementsTimer);
    }

    this._postRenderEnhancementsTimer = setTimeout(() => {
      const tableContainer =
        wrapper.querySelector(".league-body-scroll") ||
        wrapper.querySelector(".league-content-container") ||
        wrapper.querySelector(".uefa-section-scroll");
      const backToTopControls = wrapper.querySelector(".back-to-top-controls");
      if (tableContainer && backToTopControls) {
        tableContainer.addEventListener(
          "scroll",
          () => {
            this.updateScrollButtons();
          },
          { passive: true }
        );
        this._attachScrollPause(tableContainer);
        this.updateScrollButtons();
      }
      this.updateTeamNameColumnWidth();
      this._initializeFixtureMarquees(wrapper);
      if (this.isCycleEnabled()) {
        this._startHeaderCountdown();
      }
      this._postRenderEnhancementsTimer = null;
    }, 100);
  },

  // Generate the DOM content
  getDom() {
    this._teardownFixtureMarquees();
    const currentData = this.getRenderLeagueData(this.currentLeague);
    if (this.isContentHidden) {
      return this.renderHiddenState(currentData);
    }

    this._applyThemeOverrides();
    const _wrapper = this._super();
    let wrapper;

    const renderDom = (w) => {
      wrapper = w;
      this._lastRenderedWrapper = w;
      this._countdownEl = w.querySelector(".cycle-countdown");
      this.bindChromeInteractions(w);

      const leagueTabsContainer = w.querySelector(".league-buttons-container");
      if (leagueTabsContainer) {
        this._addHorizontalScrollIndicators(leagueTabsContainer);
      }

      const subTabsContainer = w.querySelector(".wc-subtabs-container");
      if (subTabsContainer) {
        this._addHorizontalScrollIndicators(subTabsContainer);
      }

      this.renderContentBody(
        w.querySelector('[data-slot="content-body"]'),
        currentData
      );
      this.populateFooterSource(w, currentData);
      this.schedulePostRenderEnhancements(w);
    };

    if (_wrapper instanceof Promise) {
      _wrapper.then(renderDom).catch((error) => {
        Log.error("MMM-SoccerStandings: Error rendering DOM", error);
      });
    } else {
      renderDom(_wrapper);
    }

    return wrapper;
  },

  // Create the league table
  createTable(leagueData, leagueKey) {
    // Create the outer wrapper that holds everything
    const outerWrapper = document.createElement("div");
    outerWrapper.className = "league-table-wrapper-v2";
    if (leagueKey) outerWrapper.classList.add(leagueKey);
    const formGamesToShow = this.getConfiguredFormGameCount();
    const formCountClass = this.getFormCountClass(formGamesToShow);

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

    headerRow.appendChild(
      this.createTableHeader(this.translate("COL_POSITION"), "position-header")
    );

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
        this.createTableHeader(
          this.translate("COL_FORM"),
          `form-header ${formCountClass}`
        )
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
    let _colCount = 2; // position and team columns always present
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

        var posCell = document.createElement("td");
        posCell.textContent = Number.isFinite(team.position)
          ? team.position
          : "-";
        posCell.className = "position-cell";
        row.appendChild(posCell);

        var teamCell = document.createElement("td");
        teamCell.className = "team-cell";
        var teamCellContent = document.createElement("div");
        teamCellContent.className = "team-cell-content";

        if (this.config.showTeamLogos && team.logo) {
          var logoBox = document.createElement("span");
          logoBox.className = "team-logo";
          logoBox.setAttribute("aria-hidden", "true");
          logoBox.style.backgroundImage = `url("${team.logo}")`;
          teamCellContent.appendChild(logoBox);
        }

        var nameSpan = document.createElement("span");
        nameSpan.className = "team-name";
        nameSpan.textContent = this.translateTeamName(team.name);
        teamCellContent.appendChild(nameSpan);
        teamCell.appendChild(teamCellContent);
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
          formCell.className = `form-cell ${formCountClass}`;
          var formWrapper = document.createElement("div");
          formWrapper.className = this.config.enhancedIndicatorShapes
            ? `form-tokens form-tokens--enhanced ${formCountClass}`
            : `form-tokens form-tokens--flat ${formCountClass}`;

          var formArr = Array.isArray(team.form) ? team.form : [];
          var maxGames = formGamesToShow;
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
    this._teardownFixtureMarquees();
    if (this._postRenderEnhancementsTimer) {
      clearTimeout(this._postRenderEnhancementsTimer);
      this._postRenderEnhancementsTimer = null;
    }
    if (this.updateTimer) {
      clearTimeout(this.updateTimer);
      this.updateTimer = null;
    }
    if (this.imageObserver) {
      this.imageObserver.disconnect();
      this.imageObserver = null;
    }
  },
  resume() {
    this.scheduleUpdate();
    this._resumeCyclingIfNeeded();
    this._startHeaderCountdown();
    if (this._lastRenderedWrapper) {
      this.schedulePostRenderEnhancements(this._lastRenderedWrapper);
    }
  },

  _teardownFixtureMarquees() {
    const bindings = Array.isArray(this._fixtureMarqueeBindings)
      ? this._fixtureMarqueeBindings
      : [];
    bindings.forEach((binding) => {
      if (binding && binding.timerId) {
        clearInterval(binding.timerId);
      }
      if (binding && binding.container && binding.container.style) {
        binding.container.classList.remove("fixture-marquee-active");
        binding.container.scrollTop = 0;
      }
    });
    this._fixtureMarqueeBindings = [];
  },

  _initializeFixtureMarquees(wrapper) {
    this._teardownFixtureMarquees();
    if (!wrapper) {
      return;
    }

    const containers = Array.from(
      wrapper.querySelectorAll(".fixtures-body-scroll")
    );
    containers.forEach((container) => this._setupFixtureMarquee(container));
  },

  _setupFixtureMarquee(container) {
    if (!container) {
      return;
    }

    const rows = Array.from(container.querySelectorAll(".fixture-card-v3"));
    if (!this.shouldEnableFixtureMarquee(rows.length)) {
      return;
    }

    const pageSize = this.getMarqueePageSize();
    const intervalMs = this.getMarqueePageIntervalMs();
    if (!pageSize || !intervalMs) {
      return;
    }

    const getMetrics = () => {
      const currentRows = Array.from(
        container.querySelectorAll(".fixture-card-v3")
      );
      if (currentRows.length <= pageSize) {
        return null;
      }

      const pageOffsets = [];
      for (let index = 0; index < currentRows.length; index += pageSize) {
        pageOffsets.push(currentRows[index].offsetTop);
      }

      return pageOffsets.length > 1 ? { pageOffsets } : null;
    };

    if (!getMetrics()) {
      return;
    }

    container.classList.add("fixture-marquee-active");
    container.scrollTop = 0;

    let currentPageIndex = 0;
    const timerId = setInterval(() => {
      const metrics = getMetrics();
      if (!metrics) {
        return;
      }

      currentPageIndex = (currentPageIndex + 1) % metrics.pageOffsets.length;
      container.scrollTo({
        top: metrics.pageOffsets[currentPageIndex] || 0,
        behavior: "smooth"
      });
    }, intervalMs);

    this._fixtureMarqueeBindings.push({ container, timerId });
  },

  // Header countdown helpers
  formatCompactNumber(value) {
    if (!Number.isFinite(value)) {
      return "";
    }

    const roundedValue = Math.round(value);
    const absoluteValue = Math.abs(roundedValue);
    if (absoluteValue < 1000) {
      return String(roundedValue);
    }

    const compactUnits = [
      { threshold: 1e12, suffix: "T" },
      { threshold: 1e9, suffix: "B" },
      { threshold: 1e6, suffix: "M" },
      { threshold: 1e3, suffix: "K" }
    ];
    const unit = compactUnits.find(
      ({ threshold }) => absoluteValue >= threshold
    );
    const scaledValue = roundedValue / unit.threshold;
    const fractionDigits = Math.abs(scaledValue) < 10 ? 1 : 0;
    return `${scaledValue.toFixed(fractionDigits).replace(/\.0$/, "")}${unit.suffix}`;
  },

  getCycleCountdownStartValue() {
    const base = this.config.cycleInterval || 15000;
    if (!base || base <= 0) {
      return null;
    }

    return Math.ceil(base / 1000);
  },

  _startHeaderCountdown() {
    this._stopHeaderCountdown();
    if (!this.isCycleEnabled()) return;
    if (!this._countdownEl) return;
    this._countdownEl.classList.remove("is-paused");
    const startValue = this.getCycleCountdownStartValue();
    if (startValue === null) {
      this._countdownEl.textContent = "";
      return;
    }
    if (this._pinned || this.isScrolling) {
      this._countdownEl.textContent = this.formatCompactNumber(startValue);
      this._countdownEl.classList.add("is-paused");
      return;
    }
    let remaining = startValue;
    const tick = () => {
      if (!this._countdownEl) return;
      this._countdownEl.textContent = this.formatCompactNumber(remaining);
      remaining -= 1;
      if (remaining < 0) remaining = startValue;
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
      const startValue = this.getCycleCountdownStartValue();
      const isPaused = this._pinned || this.isScrolling;
      this._countdownEl.classList.toggle("is-paused", isPaused);
      this._countdownEl.textContent =
        isPaused && startValue !== null
          ? this.formatCompactNumber(startValue)
          : "";
    }
  },

  // ===== NEW: World Cup & UEFA View Renderer =====
  createWorldCupView(currentData) {
    var container = document.createElement("div");
    container.className = "wc-view-container";
    const fragment = document.createDocumentFragment();

    const subTabId = this.currentSubTab;
    const subTabMeta = subTabId
      ? this.getCanonicalCompetitionSubTab(this.currentLeague, subTabId)
      : null;
    const subTab = this.getCompetitionSubTabRuntimeId(
      this.currentLeague,
      subTabId
    );
    const displaySubTab =
      subTabMeta && subTabMeta.label ? subTabMeta.label : subTab;
    const tSubTab = this.translate(
      String(displaySubTab).trim().toUpperCase().replace(/\s+/g, "_")
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
          const { isFinished, isLive } = this.getFixtureStateFlags(f);
          return isFinished || isLive;
        });

        const recomputedLive = allFixtures.filter(
          (f) => this.getFixtureStateFlags(f).isLive
        );

        const recomputedToday = allFixtures.filter((f) => {
          if (f.date !== todayStr) return false;
          const { isFinished, isLive } = this.getFixtureStateFlags(f);
          return !isFinished && !isLive;
        });

        const recomputedFuture = allFixtures.filter((f) => {
          if (f.date <= todayStr) return false;
          const { isFinished, isLive } = this.getFixtureStateFlags(f);
          return !isFinished && !isLive;
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

        // Filter fixtures using phase date range from catalog navigation.
        // subTabMeta.startDate / endDate come from the ESPN service league catalog
        // and are always precise — no hardcoded month guesses needed.
        const phaseStart =
          subTabMeta && subTabMeta.startDate
            ? Date.parse(subTabMeta.startDate)
            : null;
        const phaseEnd =
          subTabMeta && subTabMeta.endDate
            ? Date.parse(subTabMeta.endDate)
            : null;

        const filterStageFixtures = (fixtures) => {
          return fixtures.filter((f) => {
            if (!f.timestamp) return false;
            if (phaseStart != null && phaseEnd != null) {
              return f.timestamp >= phaseStart && f.timestamp < phaseEnd;
            }
            // No phase dates available — include all (caller already
            // narrowed the list by status bucket).
            return true;
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

        const visibleStageResults =
          this.getMostRecentFixturesFirst(stageResults);
        const hasResults = visibleStageResults.length > 0;
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
            this.createFixturesTable(visibleStageResults, false, "desc")
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
        if (visibleStageResults.length > 0 || allUpcoming.length > 0) {
          fragment.appendChild(splitViewContainer);
        } else {
          var msg = document.createElement("div");
          msg.className = "dimmed fixtures-empty-placeholder";
          msg.style.textAlign = "center";
          msg.textContent = this.translate("FIXTURES_NOT_AVAILABLE", {
            subTab:
              tSubTab !== subTab && tSubTab !== "" ? tSubTab : displaySubTab
          });
          fragment.appendChild(msg);
        }
      } else {
        // Standard view for other stages/leagues
        var title = document.createElement("div");
        title.className = "wc-title";
        title.textContent = this.translate("SUBTAB_FIXTURES", {
          subTab: tSubTab !== subTab && tSubTab !== "" ? tSubTab : displaySubTab
        });
        fragment.appendChild(title);

        if (knockoutFixtures.length > 0) {
          fragment.appendChild(this.createFixturesTable(knockoutFixtures));
        } else {
          var msg = document.createElement("div");
          msg.className = "dimmed fixtures-empty-placeholder";
          msg.style.textAlign = "center";
          msg.style.marginTop = "10px";
          if (this.isUEFAOffSeason()) {
            msg.textContent = this.translate("AWAITING_DRAW");
            msg.className = "bright fixtures-empty-placeholder";
          } else {
            msg.textContent = this.translate("FIXTURES_NOT_AVAILABLE", {
              subTab:
                tSubTab !== subTab && tSubTab !== "" ? tSubTab : displaySubTab
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
      groupTitle.textContent = displaySubTab;
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
        group: displaySubTab
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
      noDataMsg.className = "dimmed light fixtures-empty-placeholder";
      fragment.appendChild(noDataMsg);
    }

    container.appendChild(fragment);
    return container;
  },

  // ===== NEW: Create Fixtures Table =====
  createFixturesTable(fixtures, showHeader = true, sortDirection = "asc") {
    const outerWrapper = document.createElement("div");
    outerWrapper.className = "fixtures-container";

    if (!fixtures || fixtures.length === 0) return outerWrapper;

    const orderedFixtures = Array.isArray(fixtures) ? fixtures.slice() : [];
    const sortMultiplier = sortDirection === "desc" ? -1 : 1;

    // Sort fixtures by timestamp or date
    orderedFixtures.sort(
      (a, b) => ((a.timestamp || 0) - (b.timestamp || 0)) * sortMultiplier
    );

    fixtures = orderedFixtures;

    const wrapperV2 = document.createElement("div");
    wrapperV2.className = "fixtures-wrapper-v2";
    if (!showHeader) {
      wrapperV2.classList.add("is-headerless");
    }

    const scrollContainer = document.createElement("div");
    scrollContainer.className = "fixtures-body-scroll";
    if (this.shouldEnableFixtureMarquee(fixtures.length)) {
      scrollContainer.classList.add("fixture-paged-scroll");
      const marqueeViewportHeight = this.getFixtureMarqueeViewportHeight();
      if (marqueeViewportHeight) {
        scrollContainer.style.maxHeight = marqueeViewportHeight;
      }
    }

    const list = document.createElement("div");
    list.className = "fixtures-list-v3";

    let foundCurrent = false;
    const now = this.getCurrentDate().getTime();
    const today = this.getCurrentDateString();
    const twoLeggedMap = { Playoff: 8, Rd32: 8, Rd16: 8, QF: 4, SF: 2 };
    const firstLegCount = twoLeggedMap[this.currentSubTab];

    fixtures.forEach((fix, index) => {
      const row = this.buildFixtureCardRow(fix);
      const { isFinished, isLive } = this.getFixtureStateFlags(fix);

      if (isLive) {
        row.classList.add("live");
      } else if (isFinished) {
        row.classList.add("finished");
      } else {
        row.classList.add("upcoming");
      }

      if (
        firstLegCount &&
        !foundCurrent &&
        fixtures.length >= firstLegCount * 2
      ) {
        const firstLegsFinished = fixtures
          .slice(0, firstLegCount)
          .every((fixture) => {
            const flags = this.getFixtureStateFlags(fixture);
            return flags.isFinished;
          });
        if (firstLegsFinished && index === firstLegCount) {
          row.classList.add("current-fixture");
          foundCurrent = true;
        }
      }

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

      list.appendChild(row);
    });

    scrollContainer.appendChild(list);
    wrapperV2.appendChild(scrollContainer);
    outerWrapper.appendChild(wrapperV2);

    if (!this.shouldEnableFixtureMarquee(fixtures.length)) {
      setTimeout(() => {
        const current = scrollContainer.querySelector(".current-fixture");
        if (current) {
          current.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 1000);
    }

    return outerWrapper;
  },

  buildFixtureCardRow(fix) {
    const row = document.createElement("div");
    row.className = "fixture-row-v2 fixture-card-v3";

    const displayModel = this.getFixtureDisplayModel(fix);
    const layout = document.createElement("div");
    layout.className = "fixture-card-layout-v3";
    layout.appendChild(this.buildFixtureDateBlock(fix, displayModel));

    const content = document.createElement("div");
    content.className = "fixture-card-content-v3";

    const matchRow = document.createElement("div");
    matchRow.className = "fixture-card-match-row-v3";
    matchRow.appendChild(
      this.buildFixtureTeamBlock(fix.homeTeam, true, fix.homeLogo)
    );
    matchRow.appendChild(this.buildFixtureScoreBlock(displayModel));
    matchRow.appendChild(
      this.buildFixtureTeamBlock(fix.awayTeam, false, fix.awayLogo)
    );

    const venueRow = document.createElement("div");
    venueRow.className = "fixture-venue-row-v3";
    venueRow.textContent = (fix.venue || fix.location || "").trim() || "\u00A0";

    content.appendChild(matchRow);
    content.appendChild(venueRow);
    layout.appendChild(content);
    row.appendChild(layout);

    return row;
  },

  buildFixtureDateBlock(fix, displayModel) {
    const dateBlock = document.createElement("div");
    dateBlock.className = "fixture-date-block-v3";

    const dateLabel = document.createElement("div");
    dateLabel.className = "fixture-date-main-v3";
    dateLabel.textContent = this.formatFixtureDateLabel(fix) || "\u00A0";

    const timeLabel = document.createElement("div");
    timeLabel.className = "fixture-time-secondary-v3";
    timeLabel.textContent =
      this.getFixtureKickoffLabel(fix) ||
      (displayModel.isUpcoming ? "TBD" : "\u00A0");

    dateBlock.appendChild(dateLabel);
    dateBlock.appendChild(timeLabel);

    return dateBlock;
  },

  buildFixtureTeamBlock(teamName, isHome, logoPath) {
    const teamBlock = document.createElement("div");
    teamBlock.className = `fixture-team-block-v3 ${isHome ? "home" : "away"}`;
    this.addFlagAndNameToCell(teamBlock, teamName, isHome, logoPath);
    return teamBlock;
  },

  buildFixtureScoreBlock(displayModel) {
    const scoreBlock = document.createElement("div");
    scoreBlock.className = "fixture-score-block-v3";

    const mainScore = document.createElement("div");
    mainScore.className = "main-score-v2";
    if (displayModel.isLive) {
      mainScore.classList.add("bright");
    }
    mainScore.textContent = displayModel.mainText;

    scoreBlock.appendChild(mainScore);

    if (displayModel.aggregateText) {
      const aggregateScore = document.createElement("div");
      aggregateScore.className = "aggregate-score-v2";
      aggregateScore.textContent = displayModel.aggregateText;
      scoreBlock.appendChild(aggregateScore);
    }

    return scoreBlock;
  },

  getFixtureDisplayModel(fix) {
    const { isFinished, isLive, isUpcoming } = this.getFixtureStateFlags(fix);
    const hasMatchScore =
      fix.homeScore !== undefined &&
      fix.homeScore !== null &&
      fix.awayScore !== undefined &&
      fix.awayScore !== null;
    const fallbackScore =
      typeof fix.score === "string" &&
      fix.score.trim() &&
      fix.score.trim() !== "vs"
        ? fix.score.trim()
        : null;
    const mainText = isUpcoming
      ? "vs"
      : hasMatchScore
        ? `${fix.homeScore} - ${fix.awayScore}`
        : fallbackScore || "vs";

    return {
      isFinished,
      isLive,
      isUpcoming,
      mainText,
      aggregateText: this.getFixtureAggregateLabel(fix)
    };
  },

  getFixtureAggregateLabel(fix) {
    if (fix.aggregateScore) {
      return fix.aggregateScore;
    }

    if (
      fix.isSecondLeg &&
      fix.firstLegFixture &&
      fix.firstLegFixture.homeScore !== undefined &&
      fix.firstLegFixture.awayScore !== undefined
    ) {
      return `${fix.firstLegFixture.awayScore} - ${fix.firstLegFixture.homeScore}`;
    }

    return null;
  },

  getFixtureKickoffLabel(fix) {
    const time = typeof fix.time === "string" ? fix.time.trim() : "";
    return /^\d{1,2}:\d{2}$/.test(time) ? time : "";
  },

  formatFixtureDateLabel(fix) {
    if (fix && typeof fix.date === "string") {
      const match = fix.date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (match) {
        return `${match[3]}/${match[2]}`;
      }
    }

    const dateValue =
      fix && fix.timestamp
        ? new Date(fix.timestamp)
        : this.getFixtureDateTimeValue(fix);
    if (!(dateValue instanceof Date) || isNaN(dateValue.getTime())) {
      return "";
    }

    const day = String(dateValue.getDate()).padStart(2, "0");
    const month = String(dateValue.getMonth() + 1).padStart(2, "0");
    return `${day}/${month}`;
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

  // Adds horizontal scroll indicators (arrows) to a container
  _addHorizontalScrollIndicators(container) {
    if (!container || !container.parentNode) return;
    if (
      container.parentNode.classList &&
      container.parentNode.classList.contains("league-tabs-wrapper")
    ) {
      return;
    }

    const wrapper = document.createElement("div");
    wrapper.className = "league-tabs-wrapper";
    const parent = container.parentNode;
    const nextSibling = container.nextSibling;

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
    if (nextSibling) {
      parent.insertBefore(wrapper, nextSibling);
    } else {
      parent.appendChild(wrapper);
    }

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

    if (this.config.darkMode === null) {
      if (styleEl) styleEl.remove();
      return;
    }

    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }

    let css = "";
    if (this.config.darkMode === true) {
      css +=
        ".soccer-standings { background-color: #111 !important; color: #fff !important; }\n";
    } else if (this.config.darkMode === false) {
      css +=
        ".soccer-standings { background-color: #f5f5f5 !important; color: #000 !important; }\n";
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
