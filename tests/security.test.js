const assert = require("assert");

const {
	COMPETITION_KEYS,
	getCompetitionKey,
	getCompetitionValue
} = require("../constants/competition-keys.js");
const {
	buildCanonicalGroupedStandingsPayload,
	buildCanonicalStandingsPayload,
	getDefaultSlug,
	isSupportedCanonicalCompetition,
	resolveEspnSoccerApiConfig
} = require("../backend/slice1-flat-standings.js");
const {
	buildCompetitionCatalogIndex,
	getCompetitionCatalogEntry
} = require("../backend/competition-catalog.js");
const {
	initializeCanonicalProvider
} = require("../backend/canonical-provider-registry.js");
require("../backend/providers/espn-soccer-canonical-provider.js");
require("../competition-provider.js");
require("../canonical-view-adapter.js");
require("../providers/competition-provider-espn-service.js");

function loadRegisteredModuleDefinition() {
	const modulePath = require.resolve("../MMM-SoccerStandings.js");
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

const moduleDefinition = loadRegisteredModuleDefinition();

describe("API-first functional scope", () => {
	it("resolves active competition keys and provider slugs bidirectionally", () => {
		assert.strictEqual(
			getCompetitionValue(COMPETITION_KEYS.COLOMBIA_PRIMERA, "espn_service"),
			"col.1"
		);
		assert.strictEqual(
			getCompetitionValue(COMPETITION_KEYS.UEFA_CHAMPIONS, "espn_service"),
			"uefa.champions"
		);
		assert.strictEqual(
			getCompetitionKey("fifa.world", "espn_service"),
			COMPETITION_KEYS.FIFA_WORLD
		);
		assert.strictEqual(
			getCompetitionKey("col.1", "espn_service"),
			COMPETITION_KEYS.COLOMBIA_PRIMERA
		);
		assert.strictEqual(
			getCompetitionKey("UEFA_CHAMPIONS_LEAGUE", "espn_service"),
			COMPETITION_KEYS.UEFA_CHAMPIONS
		);
		assert.strictEqual(
			getCompetitionKey("WORLD_CUP_2026", "espn_service"),
			COMPETITION_KEYS.FIFA_WORLD
		);
	});

	it("indexes competition names and abbreviations from the API catalog", () => {
		const catalog = buildCompetitionCatalogIndex([
			{
				slug: "col.1",
				name: "Colombian Primera A",
				abbreviation: "Colombian Primera A",
				has_legs: true
			},
			{
				slug: "fifa.world",
				name: "FIFA World Cup",
				abbreviation: "FIFA World Cup",
				has_legs: false
			}
		]);

		assert.deepStrictEqual(getCompetitionCatalogEntry(catalog, "col.1"), {
			slug: "col.1",
			name: "Colombian Primera A",
			abbreviation: "Colombian Primera A",
			hasLegs: true
		});
		assert.deepStrictEqual(getCompetitionCatalogEntry(catalog, "FIFA.WORLD"), {
			slug: "fifa.world",
			name: "FIFA World Cup",
			abbreviation: "FIFA World Cup",
			hasLegs: false
		});
	});

	it("resolves the ESPN service config from top-level request fields", () => {
		assert.deepStrictEqual(
			resolveEspnSoccerApiConfig({
				espnSoccerApiBaseUrl: "http://127.0.0.1:3200/",
				espnSoccerApiTimeout: 4321
			}),
			{
				baseUrl: "http://127.0.0.1:3200",
				timeoutMs: 4321
			}
		);
	});

	it("builds flat canonical standings payloads for col.1", () => {
		const payload = buildCanonicalStandingsPayload({
			leagueType: COMPETITION_KEYS.COLOMBIA_PRIMERA,
			slug: getDefaultSlug(COMPETITION_KEYS.COLOMBIA_PRIMERA),
			leagueName: "Colombian Primera A",
			leagueAbbreviation: "Colombian Primera A",
			standingsResults: [
				{
					team_espn_id: "5264",
					team_name: "Atletico Nacional",
					team_abbreviation: "NAL",
					season_year: 2026,
					season_type: 1,
					rank: 1,
					wins: 13,
					losses: 3,
					ties: 1,
					points: 40,
					form: ["W", "W", "D"],
					stats: [
						{ name: "pointsFor", value: 35 },
						{ name: "pointsAgainst", value: 13 },
						{ name: "pointDifferential", value: 22 }
					]
				}
			],
			fixturesResults: [
				{
					id: "fix-1",
					date: "2026-04-24T20:00:00Z",
					status: "STATUS_SCHEDULED",
					venue_name: "Atanasio Girardot",
					competitors: [
						{
							home_away: "home",
							score: null,
							score_int: null,
							team: {
								espn_id: "5264",
								display_name: "Atletico Nacional",
								abbreviation: "NAL",
								primary_logo: "https://img.example/nal.png"
							}
						},
						{
							home_away: "away",
							score: null,
							score_int: null,
							team: {
								espn_id: "5485",
								display_name: "Deportivo Pasto",
								abbreviation: "PAS",
								primary_logo: "https://img.example/pas.png"
							}
						}
					]
				}
			]
		});

		assert.strictEqual(payload.competition.code, COMPETITION_KEYS.COLOMBIA_PRIMERA);
		assert.strictEqual(payload.competition.slug, "col.1");
		assert.strictEqual(payload.competition.name, "Colombian Primera A");
		assert.strictEqual(
			payload.competition.abbreviation,
			"Colombian Primera A"
		);
		assert.strictEqual(payload.standings.kind, "flat");
		assert.strictEqual(payload.standings.rows.length, 1);
		assert.strictEqual(
			payload.standings.rows[0].team.logos.primary,
			"https://img.example/nal.png"
		);
		assert.strictEqual(payload.fixtures.items.length, 1);
		assert.strictEqual(payload.state.status, "ready");
		assert.strictEqual(payload.fixtures.items[0].home.name, "Atletico Nacional");
		assert.strictEqual(payload.fixtures.items[0].away.name, "Deportivo Pasto");
	});

	it("builds grouped canonical payloads for fifa.world without legacy parser data", () => {
		const payload = buildCanonicalGroupedStandingsPayload({
			leagueType: COMPETITION_KEYS.FIFA_WORLD,
			slug: getDefaultSlug(COMPETITION_KEYS.FIFA_WORLD),
			leagueName: "FIFA World Cup",
			leagueAbbreviation: "FIFA World Cup",
			groupedData: {
				groups: {
					A: [
						{
							position: 1,
							name: "Mexico",
							logo: "https://img.example/mex.png",
							played: 3,
							won: 2,
							drawn: 1,
							lost: 0,
							goalsFor: 5,
							goalsAgainst: 2,
							goalDifference: 3,
							points: 7,
							form: ["W", "D", "W"]
						}
					]
				},
				fixtures: [
					{
						homeTeam: "Mexico",
						awayTeam: "Japan",
						homeLogo: "https://img.example/mex.png",
						awayLogo: "https://img.example/jpn.png",
						date: "2026-06-11",
						time: "20:00",
						location: "Azteca",
						status: "",
						live: false,
						group: "A"
					}
				],
				knockouts: {
					Rd16: [
						{
							homeTeam: "Mexico",
							awayTeam: "USA",
							date: "2026-06-28",
							time: "21:00",
							location: "Dallas",
							status: "",
							live: false
						}
					]
				}
			}
		});

		assert.strictEqual(payload.competition.code, COMPETITION_KEYS.FIFA_WORLD);
		assert.strictEqual(payload.competition.slug, "fifa.world");
		assert.strictEqual(payload.competition.name, "FIFA World Cup");
		assert.strictEqual(payload.competition.abbreviation, "FIFA World Cup");
		assert.strictEqual(payload.standings.kind, "grouped");
		assert.strictEqual(payload.standings.groups.length, 1);
		assert.strictEqual(payload.fixtures.items.length, 1);
		assert.strictEqual(payload.knockouts.Rd16.length, 1);
		assert.strictEqual(payload.state.status, "ready");
	});

	it("initializes the active canonical provider through the registry", async () => {
		const provider = initializeCanonicalProvider("espn_service", {
			catalogCache: { fetchedAt: 0, bySlug: {} },
			collectPages(resp) {
				return resp.results;
			},
			async fetchJson(url) {
				if (url.includes("/api/v1/leagues/")) {
					return {
						results: [
							{
								slug: "col.1",
								name: "Colombian Primera A",
								abbreviation: "Colombian Primera A",
								has_legs: true
							}
						]
					};
				}

				if (url.includes("/api/v1/standings/")) {
					return {
						results: [
							{
								team_espn_id: "5264",
								team_name: "Atletico Nacional",
								team_abbreviation: "NAL",
								season_year: 2026,
								season_type: 1,
								rank: 1,
								wins: 13,
								losses: 3,
								ties: 1,
								points: 40,
								stats: [
									{ name: "pointsFor", value: 35 },
									{ name: "pointsAgainst", value: 13 },
									{ name: "pointDifferential", value: 22 }
								]
							}
						]
					};
				}

				if (url.includes("/api/v1/fixtures/")) {
					return {
						results: [
							{
								id: "fix-1",
								date: "2026-04-24T20:00:00Z",
								status: "STATUS_SCHEDULED",
								venue_name: "Atanasio Girardot",
								competitors: [
									{
										home_away: "home",
										score: null,
										score_int: null,
										team: {
											espn_id: "5264",
											display_name: "Atletico Nacional",
											abbreviation: "NAL",
											primary_logo: "https://img.example/nal.png"
										}
									},
									{
										home_away: "away",
										score: null,
										score_int: null,
										team: {
											espn_id: "5485",
											display_name: "Deportivo Pasto",
											abbreviation: "PAS",
											primary_logo: "https://img.example/pas.png"
										}
									}
								]
							}
						]
					};
				}

				throw new Error(`Unexpected URL in provider test: ${url}`);
			}
		});

		const payload = await provider.fetchCompetitionPayload({
			leagueType: COMPETITION_KEYS.COLOMBIA_PRIMERA,
			slug: "col.1",
			wantsFixtures: true,
			request: {
				espnSoccerApiBaseUrl: "http://localhost:28000",
				espnSoccerApiTimeout: 8000
			}
		});

		assert.strictEqual(payload.competition.name, "Colombian Primera A");
		assert.strictEqual(
			payload.fixtures.items[0].home.logos.primary,
			"https://img.example/nal.png"
		);
	});

	it("builds grouped canonical payloads in the provider without external parsers", async () => {
		const provider = initializeCanonicalProvider("espn_service", {
			catalogCache: { fetchedAt: 0, bySlug: {} },
			collectPages(resp) {
				return resp.results;
			},
			async fetchJson(url) {
				if (url.includes("/api/v1/leagues/")) {
					return {
						results: [
							{
								slug: "fifa.world",
								name: "FIFA World Cup",
								abbreviation: "FIFA World Cup",
								has_legs: false
							}
						]
					};
				}

				if (url.includes("/api/v1/standings/")) {
					return {
						results: [
							{
								team_espn_id: "101",
								team_name: "Mexico",
								group_name: "Group A",
								rank: 1,
								wins: 2,
								losses: 0,
								ties: 1,
								points: 7,
								stats: [
									{ name: "pointsFor", value: 5 },
									{ name: "pointsAgainst", value: 2 },
									{ name: "pointDifferential", value: 3 }
								]
							},
							{
								team_espn_id: "102",
								team_name: "Japan",
								group_name: "Group A",
								rank: 2,
								wins: 1,
								losses: 1,
								ties: 1,
								points: 4,
								stats: [
									{ name: "pointsFor", value: 3 },
									{ name: "pointsAgainst", value: 3 },
									{ name: "pointDifferential", value: 0 }
								]
							}
						]
					};
				}

				if (url.includes("/api/v1/fixtures/")) {
					return {
						results: [
							{
								name: "Mexico at Japan",
								date: "2026-06-11T20:00:00Z",
								status: "STATUS_SCHEDULED",
								venue_name: "Azteca",
								competitors: [
									{
										home_away: "home",
										score: null,
										score_int: null,
										team: {
											espn_id: "101",
											display_name: "Mexico",
											primary_logo: "https://img.example/mex.png"
										}
									},
									{
										home_away: "away",
										score: null,
										score_int: null,
										team: {
											espn_id: "102",
											display_name: "Japan",
											primary_logo: "https://img.example/jpn.png"
										}
									}
								]
							},
							{
								name: "Round of 32 1 Winner at Round of 32 2 Winner",
								date: "2026-06-28T20:00:00Z",
								status: "STATUS_SCHEDULED",
								venue_name: "Dallas",
								competitors: [
									{
										home_away: "home",
										score: null,
										score_int: null,
										team: {
											espn_id: "101",
											display_name: "Mexico",
											primary_logo: "https://img.example/mex.png"
										}
									},
									{
										home_away: "away",
										score: null,
										score_int: null,
										team: {
											espn_id: "999",
											display_name: "TBD",
											primary_logo: ""
										}
									}
								]
							},
							{
								name: "Semifinal 2 Winner at Semifinal 1 Winner",
								date: "2026-07-10T20:00:00Z",
								status: "STATUS_SCHEDULED",
								venue_name: "New York",
								competitors: [
									{
										home_away: "home",
										score: null,
										score_int: null,
										team: {
											espn_id: "998",
											display_name: "Semifinal 1 Winner",
											primary_logo: ""
										}
									},
									{
										home_away: "away",
										score: null,
										score_int: null,
										team: {
											espn_id: "999",
											display_name: "Semifinal 2 Winner",
											primary_logo: ""
										}
									}
								]
							}
						]
					};
				}

				throw new Error(`Unexpected URL in grouped provider test: ${url}`);
			}
		});

		const payload = await provider.fetchCompetitionPayload({
			leagueType: COMPETITION_KEYS.FIFA_WORLD,
			slug: "fifa.world",
			wantsFixtures: true,
			request: {
				espnSoccerApiBaseUrl: "http://localhost:28000",
				espnSoccerApiTimeout: 8000
			}
		});

		assert.strictEqual(payload.standings.kind, "grouped");
		assert.strictEqual(payload.standings.groups[0].rows[0].team.logos.primary, "https://img.example/mex.png");
		assert.strictEqual(payload.fixtures.items.length, 1);
		assert.strictEqual(payload.fixtures.items[0].venue.name, "Azteca");
		assert.strictEqual(payload.knockouts.rd16.length, 1);
		assert.strictEqual(payload.knockouts.rd16[0].venue.name, "Dallas");
		assert.strictEqual(payload.knockouts.final.length, 0);
		assert.strictEqual(payload.knockouts.tp.length, 0);
	});

	it("initializes the active frontend provider through the registry", () => {
		const provider = globalThis.CompetitionProvider.initialize("espn_service", {
			config: {
				provider: "espn_service"
			}
		});

		assert.strictEqual(
			provider.resolveLeagueSlug(COMPETITION_KEYS.UEFA_CHAMPIONS),
			"uefa.champions"
		);
		assert.strictEqual(provider.isGroupedCompetition("fifa.world"), true);
		assert.deepStrictEqual(
			provider.getCompetitionInfo("col.1", {
				competition: {
					name: "Colombian Primera A",
					abbreviation: "Colombian Primera A"
				}
			}),
			{
				name: "Colombian Primera A",
				abbreviation: "CPA"
			}
		);
	});

	it("builds flat legacy-shaped view models from canonical payloads", () => {
		const payload = buildCanonicalStandingsPayload({
			leagueType: COMPETITION_KEYS.COLOMBIA_PRIMERA,
			slug: getDefaultSlug(COMPETITION_KEYS.COLOMBIA_PRIMERA),
			leagueName: "Colombian Primera A",
			leagueAbbreviation: "Colombian Primera A",
			standingsResults: [
				{
					team_espn_id: "5264",
					team_name: "Atletico Nacional",
					team_abbreviation: "NAL",
					season_year: 2026,
					season_type: 1,
					rank: 1,
					wins: 13,
					losses: 3,
					ties: 1,
					points: 40,
					form: ["W", "W", "D"],
					stats: [
						{ name: "pointsFor", value: 35 },
						{ name: "pointsAgainst", value: 13 },
						{ name: "pointDifferential", value: 22 }
					]
				}
			],
			fixturesResults: [
				{
					id: "fix-1",
					date: "2026-04-24T20:00:00Z",
					status: "STATUS_SCHEDULED",
					venue_name: "Atanasio Girardot",
					competitors: [
						{
							home_away: "home",
							score: null,
							score_int: null,
							team: {
								espn_id: "5264",
								display_name: "Atletico Nacional",
								abbreviation: "NAL",
								primary_logo: "https://img.example/nal.png"
							}
						},
						{
							home_away: "away",
							score: null,
							score_int: null,
							team: {
								espn_id: "5485",
								display_name: "Deportivo Pasto",
								abbreviation: "PAS",
								primary_logo: "https://img.example/pas.png"
							}
						}
					]
				}
			]
		});

		const viewModel = globalThis.CanonicalViewAdapter.buildStandingsViewModel(
			payload,
			"col.1"
		);

		assert.strictEqual(viewModel.leagueType, "col.1");
		assert.strictEqual(viewModel.competitionName, "Colombian Primera A");
		assert.strictEqual(viewModel.teams[0].name, "Atletico Nacional");
		assert.strictEqual(viewModel.teams[0].logo, "https://img.example/nal.png");
		assert.strictEqual(viewModel.fixtures[0].homeTeam, "Atletico Nacional");
		assert.strictEqual(viewModel.fixtures[0].awayLogo, "https://img.example/pas.png");
		assert.strictEqual(viewModel.fixtures[0].score, "vs");
		assert.ok(viewModel.meta.lastUpdated);
	});

	it("does not infer the UEFA final stage from placeholder winner fixtures", () => {
		const payload = buildCanonicalStandingsPayload({
			leagueType: COMPETITION_KEYS.UEFA_CHAMPIONS,
			slug: getDefaultSlug(COMPETITION_KEYS.UEFA_CHAMPIONS),
			leagueName: "UEFA Champions League",
			leagueAbbreviation: "UCL",
			standingsResults: [
				{
					team_espn_id: "1",
					team_name: "Arsenal",
					team_abbreviation: "ARS",
					season_year: 2026,
					season_type: 1,
					rank: 1,
					wins: 8,
					losses: 0,
					ties: 0,
					points: 24,
					stats: [
						{ name: "pointsFor", value: 23 },
						{ name: "pointsAgainst", value: 4 },
						{ name: "pointDifferential", value: 19 }
					]
				}
			],
			fixturesResults: [
				{
					id: "ucl-final",
					name: "Semifinal 2 Winner at Semifinal 1 Winner",
					date: "2026-05-30T16:00:00Z",
					status: "STATUS_SCHEDULED",
					venue_name: "Puskás Aréna",
					competitors: [
						{
							home_away: "home",
							score: null,
							score_int: null,
							team: {
								espn_id: "9001",
								display_name: "Semifinal 1 Winner",
								primary_logo: ""
							}
						},
						{
							home_away: "away",
							score: null,
							score_int: null,
							team: {
								espn_id: "9002",
								display_name: "Semifinal 2 Winner",
								primary_logo: ""
							}
						}
					]
				}
			]
		});

		assert.strictEqual(payload.fixtures.items.length, 1);
		assert.strictEqual(payload.fixtures.items[0].stage, null);
		assert.strictEqual(payload.fixtures.items[0].venue.name, "Puskás Aréna");
	});

	it("builds grouped legacy-shaped view models from canonical payloads", () => {
		const payload = buildCanonicalGroupedStandingsPayload({
			leagueType: COMPETITION_KEYS.FIFA_WORLD,
			slug: getDefaultSlug(COMPETITION_KEYS.FIFA_WORLD),
			leagueName: "FIFA World Cup",
			leagueAbbreviation: "FIFA World Cup",
			groupedData: {
				groups: {
					A: [
						{
							position: 1,
							name: "Mexico",
							logo: "https://img.example/mex.png",
							played: 3,
							won: 2,
							drawn: 1,
							lost: 0,
							goalsFor: 5,
							goalsAgainst: 2,
							goalDifference: 3,
							points: 7,
							form: ["W", "D", "W"]
						}
					]
				},
				fixtures: [
					{
						homeTeam: "Mexico",
						awayTeam: "Japan",
						homeLogo: "https://img.example/mex.png",
						awayLogo: "https://img.example/jpn.png",
						date: "2026-06-11",
						time: "20:00",
						location: "Azteca",
						status: "",
						live: false,
						group: "A"
					}
				],
				knockouts: {
					Rd16: [
						{
							homeTeam: "Mexico",
							awayTeam: "USA",
							date: "2026-06-28",
							time: "21:00",
							location: "Dallas",
							status: "",
							live: false
						}
					]
				}
			}
		});

		const viewModel = globalThis.CanonicalViewAdapter.buildGroupedStandingsViewModel(
			payload,
			"fifa.world"
		);

		assert.strictEqual(viewModel.leagueType, "fifa.world");
		assert.strictEqual(viewModel.groups.A[0].name, "Mexico");
		assert.strictEqual(viewModel.groups.A[0].logo, "https://img.example/mex.png");
		assert.strictEqual(viewModel.fixtures[0].group, "A");
		assert.strictEqual(viewModel.fixtures[0].location, "Azteca");
		assert.strictEqual(viewModel.knockouts.Rd16[0].homeTeam, "Mexico");
		assert.strictEqual(viewModel.knockouts.Rd16[0].location, "Dallas");
		assert.ok(viewModel.meta.lastUpdated);
	});

	it("limits canonical support to the narrowed active competitions", () => {
		assert.strictEqual(isSupportedCanonicalCompetition("col.1"), true);
		assert.strictEqual(isSupportedCanonicalCompetition("uefa.champions"), true);
		assert.strictEqual(isSupportedCanonicalCompetition("fifa.world"), true);
		assert.strictEqual(isSupportedCanonicalCompetition("eng.1"), false);
	});
});

describe("Module shell helpers", () => {
	it("uses fixed subtab order derived from the competition", () => {
		const moduleInstance = Object.assign({}, moduleDefinition, {
			config: {}
		});

		assert.deepStrictEqual(moduleInstance.getCompetitionSubTabs("col.1"), [
			"Table",
			"Fixtures"
		]);
		assert.deepStrictEqual(
			moduleInstance.getCompetitionSubTabs("uefa.champions"),
			["Table", "QF", "SF", "Final"]
		);
		assert.deepStrictEqual(
			moduleInstance.getCompetitionSubTabs("fifa.world"),
			[
				"A",
				"B",
				"C",
				"D",
				"E",
				"F",
				"G",
				"H",
				"I",
				"J",
				"K",
				"L",
				"Rd32",
				"Rd16",
				"QF",
				"SF",
				"TP",
				"Final"
			]
		);
		assert.strictEqual(moduleInstance.getDefaultCompetitionSubTab("fifa.world"), "A");
	});

	it("shows league buttons only when more than one league is configured", () => {
		const moduleInstance = Object.assign({}, moduleDefinition, {
			enabledLeagueCodes: ["uefa.champions"]
		});

		assert.strictEqual(moduleInstance.shouldShowLeagueButtons(), false);
		moduleInstance.enabledLeagueCodes.push("fifa.world");
		assert.strictEqual(moduleInstance.shouldShowLeagueButtons(), true);
	});

	it("falls back to staged flat fixtures when a knockout tab has no structured bucket", () => {
		const moduleInstance = Object.assign({}, moduleDefinition);
		const fixtures = [
			{ id: "sf-1", stage: "SF" },
			{ id: "final-1", stage: "Final" }
		];

		assert.deepStrictEqual(
			moduleInstance.getKnockoutFixturesForSubTab(
				{ fixtures, knockouts: {} },
				"Final"
			),
			[{ id: "final-1", stage: "Final" }]
		);
	});

	it("normalizes legacy configured league identifiers into live provider codes", () => {
		const moduleInstance = Object.assign({}, moduleDefinition, {
			config: {
				provider: "espn_service",
				selectedLeagues: [
					"UEFA_CHAMPIONS_LEAGUE",
					"COLOMBIA_PRIMERA",
					"WORLD_CUP_2026"
				]
			},
			currentLeague: null,
			enabledLeagueCodes: [],
			competitionProvider: null
		});

		moduleInstance.determineEnabledLeagues();

		assert.deepStrictEqual(moduleInstance.enabledLeagueCodes, [
			"uefa.champions",
			"col.1",
			"fifa.world"
		]);
	});
});
