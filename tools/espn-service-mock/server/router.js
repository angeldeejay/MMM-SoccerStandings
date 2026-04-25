/**
 * Fixture-backed router that mimics the narrowed ESPN service contract used by
 * this repository.
 */
const fs = require("fs");
const path = require("path");
const express = require("express");

const fixturesRoot = path.resolve(__dirname, "..", "fixtures", "espn-service");

/**
 * Read a JSON fixture from disk. Returns the full paginated response object
 * { count, next, previous, results: [...] } as stored by the real API.
 *
 * @param {string} fileName
 * @returns {{ count: number, next: null, previous: null, results: object[] }}
 */
function readFixture(fileName) {
  return JSON.parse(fs.readFileSync(path.join(fixturesRoot, fileName), "utf8"));
}

const FILE_MAP = {
  "uefa.champions": {
    standings: "standings.uefa.champions.json",
    fixtures: "fixtures.uefa.champions.json"
  },
  "col.1": {
    standings: "standings.col.1.json",
    fixtures: "fixtures.col.1.json"
  },
  "fifa.world": {
    standings: "standings.fifa.world.json",
    fixtures: "fixtures.fifa.world.json"
  }
};

/**
 * Return a paginated-style response object filtered to the requested league.
 *
 * @param {string} league
 * @param {"standings"|"fixtures"} kind
 * @returns {{ count: number, next: null, previous: null, results: object[] }}
 */
function getLeagueData(league, kind) {
  const entry =
    FILE_MAP[
      String(league || "")
        .trim()
        .toLowerCase()
    ];
  if (!entry) {
    return { count: 0, next: null, previous: null, results: [] };
  }

  return readFixture(entry[kind]);
}

/**
 * Filter fixture results by date_from / date_to query params (YYYY-MM-DD).
 * Compares against the fixture's `date` field (ISO 8601 string).
 *
 * @param {object[]} results
 * @param {string|undefined} dateFrom
 * @param {string|undefined} dateTo
 * @returns {object[]}
 */
function filterByDateRange(results, dateFrom, dateTo) {
  if (!dateFrom && !dateTo) return results;
  return results.filter((f) => {
    const fixtureDate = (f.date || "").split("T")[0];
    if (!fixtureDate) return true;
    if (dateFrom && fixtureDate < dateFrom) return false;
    if (dateTo && fixtureDate > dateTo) return false;
    return true;
  });
}

/**
 * Build the Express router exposed by the standalone mock service.
 *
 * @returns {import("express").Router}
 */
function createEspnServiceMockRouter() {
  const router = express.Router();

  router.get("/api/v1/leagues/", (req, res) => {
    const data = readFixture("leagues.json");
    const slug = req.query.slug
      ? String(req.query.slug).trim().toLowerCase()
      : null;
    if (slug) {
      const filtered = data.results.filter(
        (l) => String(l.slug || "").toLowerCase() === slug
      );
      return res.json({
        count: filtered.length,
        next: null,
        previous: null,
        results: filtered
      });
    }
    res.json(data);
  });

  router.get("/api/v1/standings/", (req, res) => {
    const data = getLeagueData(req.query.league, "standings");
    let results = data.results;

    if (req.query.current === "true") {
      const years = results
        .map((r) => Number(r.season_year))
        .filter(Number.isFinite);
      const latestYear = years.length > 0 ? Math.max(...years) : null;
      if (latestYear != null) {
        results = results.filter((r) => Number(r.season_year) === latestYear);
      }
    } else if (req.query.season) {
      const season = Number(req.query.season);
      if (Number.isFinite(season)) {
        results = results.filter((r) => Number(r.season_year) === season);
      }
    }

    res.json({ count: results.length, next: null, previous: null, results });
  });

  router.get("/api/v1/fixtures/", (req, res) => {
    const data = getLeagueData(req.query.league, "fixtures");
    const season = req.query.season ? Number(req.query.season) : null;
    let results =
      season != null && Number.isFinite(season)
        ? data.results.filter((r) => {
            const phaseYear = r.league_phase?.season_year;
            return phaseYear == null || Number(phaseYear) === season;
          })
        : data.results;
    results = filterByDateRange(
      results,
      req.query.date_from,
      req.query.date_to
    );
    res.json({ count: results.length, next: null, previous: null, results });
  });

  return router;
}

module.exports = {
  createEspnServiceMockRouter
};
