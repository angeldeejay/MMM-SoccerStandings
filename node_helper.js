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
const http = require("node:http");
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

  // Handle socket notifications from the module.
  // Declared async so awaited cache helpers can be used inline.
  // MagicMirror core does not await the return value, so ALL awaited paths
  // must be inside try/catch to prevent unhandled promise rejections.
  // this.config is set synchronously before any await point and is never
  // read after an await inside this function, so there is no real race
  // condition between concurrent notifications on this assignment.
  async socketNotificationReceived(notification, payload) {
    try {
      if (notification === "GET_COMPETITION_PAYLOAD") {
        this.config = payload;
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
    } catch (error) {
      Log.error(
        ` MMM-SoccerStandings: Unhandled error in socketNotificationReceived [${notification}]: ${error.message || error}`
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
      this.emitCanonicalCompetitionPayload(stalePayload);
    }

    try {
      const payload = await provider.fetchCompetitionPayload({
        leagueType,
        slug,
        wantsFixtures,
        request
      });

      await this.cache.set(cacheKey, payload);
      this.emitCanonicalCompetitionPayload(payload);
    } catch (error) {
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
    return new Promise((resolve, reject) => {
      const req = http.get(url, { timeout: timeoutMs }, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`ESPN Service HTTP ${res.statusCode}: ${url}`));
          res.resume();
          return;
        }
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          body += chunk;
        });
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
    this._cleanupInterval = setInterval(async () => {
      try {
        const deleted = await this.cache.cleanupExpired();
        if (deleted > 0) {
          Log.info(
            ` MMM-SoccerStandings: Automatic cache cleanup removed ${deleted} expired entries`
          );
        }
      } catch (error) {
        Log.error(
          ` MMM-SoccerStandings: Cache cleanup interval error: ${error.message || error}`
        );
      }
    }, cleanupInterval);
  },

  stop() {
    if (this._cleanupInterval) {
      clearInterval(this._cleanupInterval);
      this._cleanupInterval = null;
    }
  }
});
