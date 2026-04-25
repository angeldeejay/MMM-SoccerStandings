/**
 * Fixture-backed router that mimics the narrowed ESPN service contract used by
 * this repository.
 */
const fs = require("fs");
const path = require("path");
const express = require("express");

const fixturesRoot = path.resolve(__dirname, "..", "fixtures", "espn-service");

/**
 * Read a JSON fixture from disk.
 *
 * @param {string} fileName
 * @returns {*}
 */
function readFixture(fileName) {
	return JSON.parse(
		fs.readFileSync(path.join(fixturesRoot, fileName), "utf8")
	);
}

/**
 * Resolve the fixture file used for one supported league and payload kind.
 *
 * @param {string} league
 * @param {"standings"|"fixtures"} kind
 * @returns {Array}
 */
function getLeagueFixtures(league, kind) {
	const fileMap = {
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

	const entry = fileMap[String(league || "").trim().toLowerCase()];
	if (!entry) {
		return [];
	}

	return readFixture(entry[kind]);
}

/**
 * Build the Express router exposed by the standalone mock service.
 *
 * @returns {import("express").Router}
 */
function createEspnServiceMockRouter() {
	const router = express.Router();

	router.get("/api/v1/leagues/", (_req, res) => {
		res.json({ results: readFixture("leagues.json") });
	});

	router.get("/api/v1/standings/", (req, res) => {
		res.json({
			results: getLeagueFixtures(req.query.league, "standings")
		});
	});

	router.get("/api/v1/fixtures/", (req, res) => {
		res.json({
			results: getLeagueFixtures(req.query.league, "fixtures")
		});
	});

	return router;
}

module.exports = {
	createEspnServiceMockRouter
};
