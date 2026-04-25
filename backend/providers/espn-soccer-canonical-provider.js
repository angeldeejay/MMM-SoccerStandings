const { COMPETITION_KEYS } = require("../../constants/competition-keys.js");
const { registerCanonicalProvider } = require("../canonical-provider-registry.js");
const {
	buildCanonicalGroupedStandingsPayload,
	buildCanonicalStandingsPayload,
	resolveEspnSoccerApiConfig,
	isSupportedGroupedStandingsCompetition
} = require("../slice1-flat-standings.js");
const {
	buildCompetitionCatalogIndex,
	getCompetitionCatalogEntry
} = require("../competition-catalog.js");

function humanizeSlug(slug) {
	if (typeof slug !== "string" || !slug.trim()) {
		return null;
	}

	return slug
		.trim()
		.split(".")
		.filter(Boolean)
		.map((segment) =>
			segment
				.replace(/[_-]+/g, " ")
				.replace(/\b\w/g, (char) => char.toUpperCase())
		)
		.join(" ");
}

function mapStandingEntry(entry, fallbackPos) {
	if (!entry || !entry.team_name) {
		return null;
	}

	const statsMap = {};
	(Array.isArray(entry.stats) ? entry.stats : []).forEach((stat) => {
		if (stat && stat.name != null) {
			statsMap[stat.name] = stat.value;
		}
	});

	const goalsFor = statsMap.pointsFor ?? 0;
	const goalsAgainst = statsMap.pointsAgainst ?? 0;
	const goalDiff = statsMap.pointDifferential ?? (goalsFor - goalsAgainst);
	const wins = Number(entry.wins) || 0;
	const losses = Number(entry.losses) || 0;
	const ties = Number(entry.ties) || 0;

	return {
		position: entry.rank ?? fallbackPos,
		name: entry.team_name,
		providerId: entry.team_espn_id ? String(entry.team_espn_id) : null,
		logo: entry.primary_logo || entry.logo || null,
		played: wins + losses + ties,
		won: wins,
		drawn: ties,
		lost: losses,
		goalsFor: Number(goalsFor) || 0,
		goalsAgainst: Number(goalsAgainst) || 0,
		goalDifference: Number(goalDiff) || 0,
		points: entry.points ?? 0,
		form: Array.isArray(entry.last_3_form)
			? entry.last_3_form.map((result) => ({ result: String(result).toUpperCase() }))
			: []
	};
}

function parseGroupedStandings(results, leagueCode) {
	if (!Array.isArray(results) || results.length === 0) {
		return null;
	}

	const groups = {};
	results.forEach((entry) => {
		const match = String(entry.group_name || "").match(/Group\s+([A-Z])/i);
		const groupKey = match ? match[1].toUpperCase() : entry.group_name || "?";
		if (!groups[groupKey]) {
			groups[groupKey] = [];
		}

		const mappedEntry = mapStandingEntry(entry, groups[groupKey].length + 1);
		if (mappedEntry) {
			groups[groupKey].push(mappedEntry);
		}
	});

	Object.keys(groups).forEach((groupKey) => {
		if (!groups[groupKey].length) {
			delete groups[groupKey];
		}
	});

	if (!Object.keys(groups).length) {
		return null;
	}

	return {
		groups,
		fixtures: [],
		knockouts: {
			rd32: [],
			rd16: [],
			qf: [],
			sf: [],
			tp: [],
			final: []
		},
		leagueType: leagueCode,
		source: "ESPN_SERVICE",
		lastUpdated: new Date().toISOString()
	};
}

function normalizeEventStatus(status) {
	return String(status || "").trim().toLowerCase();
}

function mapEvent(eventEntry) {
	if (
		!eventEntry ||
		!Array.isArray(eventEntry.competitors) ||
		eventEntry.competitors.length < 2
	) {
		return null;
	}

	const home =
		eventEntry.competitors.find((competitor) => competitor.home_away === "home") ||
		eventEntry.competitors[0];
	const away =
		eventEntry.competitors.find((competitor) => competitor.home_away === "away") ||
		eventEntry.competitors[1];

	if (!home?.team || !away?.team) {
		return null;
	}

	const iso = eventEntry.date || "";
	const date = iso.split("T")[0] || "";
	const time = iso.split("T")[1]?.substring(0, 5) || "00:00";
	const normalizedStatus = normalizeEventStatus(eventEntry.status);
	const statusDetail = eventEntry.status_detail || "";

	let displayStatus = "";
	let live = false;
	let score = "vs";
	let homeScore;
	let awayScore;

	if (normalizedStatus === "final" || normalizedStatus === "status_final") {
		displayStatus = "FT";
		homeScore = home.score_int ?? parseInt(home.score, 10) ?? 0;
		awayScore = away.score_int ?? parseInt(away.score, 10) ?? 0;
		score = `${homeScore} - ${awayScore}`;
	} else if (
		normalizedStatus === "in_progress" ||
		normalizedStatus === "status_in_progress"
	) {
		live = true;
		displayStatus = statusDetail || "LIVE";
		homeScore = home.score_int ?? parseInt(home.score, 10) ?? 0;
		awayScore = away.score_int ?? parseInt(away.score, 10) ?? 0;
		score = `${homeScore} - ${awayScore}`;
	} else if (
		normalizedStatus === "postponed" ||
		normalizedStatus === "status_postponed"
	) {
		displayStatus = "PST";
	} else if (
		normalizedStatus === "cancelled" ||
		normalizedStatus === "status_cancelled"
	) {
		displayStatus = "CANC";
	}

	return {
		homeTeam: home.team.display_name || "",
		awayTeam: away.team.display_name || "",
		homeLogo: home.team.primary_logo || "",
		awayLogo: away.team.primary_logo || "",
		homeProviderId:
			home.team.espn_id == null ? null : String(home.team.espn_id),
		awayProviderId:
			away.team.espn_id == null ? null : String(away.team.espn_id),
		date,
		time,
		status: displayStatus,
		live,
		score,
		homeScore,
		awayScore,
		location: eventEntry.venue_name || null,
		venue: eventEntry.venue_name || null,
		_eventName: eventEntry.name || "",
		_seasonType: eventEntry.season_type
	};
}

function parseFixtures(results) {
	return (Array.isArray(results) ? results : []).map(mapEvent).filter(Boolean);
}

function getWorldCupStageBucket(name) {
	const normalizedName = String(name || "").toLowerCase();

	/**
	 * TODO(api-staging): Re-enable semifinal placeholder -> final/third-place
	 * inference only after the upstream API emits normalized knockout stage data.
	 *
	 * Right now source names such as "Semifinal 1 Winner" / "Semifinal 1 Loser"
	 * are not trustworthy enough to remap locally without sending fixtures to the
	 * wrong tab. Leaving the old inference disabled is safer than silently
	 * manufacturing `final` / `tp` buckets from ambiguous source labels.
	 */
	// if (/semifinal\s*\d+\s*loser/.test(normalizedName)) return "tp";
	// if (/semifinal\s*\d+\s*winner/.test(normalizedName)) return "final";
	if (/semifinal\s*\d+\s*(winner|loser)/.test(normalizedName)) return null;
	if (normalizedName.includes("quarterfinal")) return "sf";
	if (normalizedName.includes("round of 16")) return "qf";
	if (normalizedName.includes("round of 32")) return "rd16";
	if (normalizedName.includes("third place group")) return "rd32";
	if (normalizedName.includes("2nd place")) return "rd32";

	return "GS";
}

function buildWorldCupData(standingsData, fixtures) {
	const groups = standingsData && standingsData.groups ? standingsData.groups : {};
	const groupFixtures = [];
	const knockouts = {
		rd32: [],
		rd16: [],
		qf: [],
		sf: [],
		tp: [],
		final: []
	};
	const teamsByName = new Map();
	const teamsByProviderId = new Map();

	Object.entries(groups).forEach(([groupId, teams]) => {
		(Array.isArray(teams) ? teams : []).forEach((team) => {
			if (!team || !team.name) {
				return;
			}

			team.group = groupId;
			teamsByName.set(String(team.name).toLowerCase(), team);
			if (team.providerId) {
				teamsByProviderId.set(team.providerId, team);
			}
		});
	});

	(Array.isArray(fixtures) ? fixtures : []).forEach((fixture) => {
		const homeTeam =
			teamsByProviderId.get(fixture.homeProviderId) ||
			teamsByName.get(String(fixture.homeTeam || "").toLowerCase()) ||
			null;
		const awayTeam =
			teamsByProviderId.get(fixture.awayProviderId) ||
			teamsByName.get(String(fixture.awayTeam || "").toLowerCase()) ||
			null;

		if (homeTeam && !homeTeam.logo && fixture.homeLogo) {
			homeTeam.logo = fixture.homeLogo;
		}
		if (awayTeam && !awayTeam.logo && fixture.awayLogo) {
			awayTeam.logo = fixture.awayLogo;
		}

		const bucket = getWorldCupStageBucket(fixture._eventName);
		if (bucket == null) {
			return;
		}
		if (bucket === "GS") {
			fixture.stage = "GS";
			fixture.group = homeTeam?.group || awayTeam?.group || null;
			groupFixtures.push(fixture);
		} else if (knockouts[bucket]) {
			knockouts[bucket].push(fixture);
		} else {
			fixture.stage = "GS";
			fixture.group = homeTeam?.group || awayTeam?.group || null;
			groupFixtures.push(fixture);
		}
	});

	[...groupFixtures, ...Object.values(knockouts).flat()].forEach((fixture) => {
		delete fixture.homeProviderId;
		delete fixture.awayProviderId;
		delete fixture._eventName;
		delete fixture._seasonType;
	});

	Object.values(groups).forEach((teams) => {
		(Array.isArray(teams) ? teams : []).forEach((team) => {
			delete team.providerId;
		});
	});

	return {
		groups,
		fixtures: groupFixtures,
		knockouts,
		leagueType: COMPETITION_KEYS.FIFA_WORLD,
		source: "ESPN_SERVICE",
		lastUpdated: new Date().toISOString()
	};
}

registerCanonicalProvider("espn_service", (options = {}) => {
	const { fetchJson, collectPages, catalogCache } = options;

	return {
		providerId: "espn-soccer-api",
		providerName: "ESPN Soccer API",

		async getCompetitionCatalogEntry(slug, request) {
			if (typeof slug !== "string" || !slug.trim()) {
				return null;
			}

			const normalizedSlug = slug.trim().toLowerCase();
			const cacheTtlMs = 60 * 60 * 1000;
			const now = Date.now();
			const bySlug =
				catalogCache &&
				catalogCache.bySlug &&
				typeof catalogCache.bySlug === "object"
					? catalogCache.bySlug
					: {};
			const isFresh =
				catalogCache &&
				now - Number(catalogCache.fetchedAt || 0) < cacheTtlMs;

			if (isFresh && bySlug[normalizedSlug]) {
				return bySlug[normalizedSlug];
			}

			const { baseUrl, timeoutMs } = resolveEspnSoccerApiConfig(request);
			const catalogResponse = await fetchJson(
				`${baseUrl}/api/v1/leagues/?limit=500`,
				timeoutMs
			);
			const catalogIndex = buildCompetitionCatalogIndex(
				collectPages(catalogResponse)
			);

			if (catalogCache && typeof catalogCache === "object") {
				catalogCache.fetchedAt = now;
				catalogCache.bySlug = catalogIndex;
			}

			return getCompetitionCatalogEntry(catalogIndex, normalizedSlug);
		},

		async fetchCompetitionPayload({ leagueType, slug, wantsFixtures, request }) {
			const { baseUrl, timeoutMs } = resolveEspnSoccerApiConfig(request);
			const standingsUrl = `${baseUrl}/api/v1/standings/?league=${slug}&current=true&limit=500`;
			const fixturesUrl = `${baseUrl}/api/v1/fixtures/?league=${slug}&limit=500&upcoming=false`;
			const [standingsResp, fixturesResp] = await Promise.all([
				fetchJson(standingsUrl, timeoutMs),
				wantsFixtures
					? fetchJson(fixturesUrl, timeoutMs)
					: Promise.resolve({ results: [] })
			]);
			const standingsResults = collectPages(standingsResp);
			const fixturesResults = wantsFixtures ? collectPages(fixturesResp) : [];

			if (standingsResults.length === 0) {
				throw new Error(
					`No canonical standings data from ESPN Soccer API for ${leagueType}`
				);
			}

			const competitionCatalogEntry = await this.getCompetitionCatalogEntry(
				slug,
				request
			);
			const leagueName =
				(competitionCatalogEntry && competitionCatalogEntry.name) ||
				humanizeSlug(slug) ||
				leagueType;
			const leagueAbbreviation =
				competitionCatalogEntry && competitionCatalogEntry.abbreviation
					? competitionCatalogEntry.abbreviation
					: null;

			if (isSupportedGroupedStandingsCompetition(leagueType)) {
				return buildCanonicalGroupedStandingsPayload({
					leagueType,
					slug,
					groupedData: buildWorldCupData(
						parseGroupedStandings(standingsResults, leagueType),
						parseFixtures(fixturesResults)
					),
					leagueName,
					leagueAbbreviation
				});
			}

			return buildCanonicalStandingsPayload({
				leagueType,
				slug,
				standingsResults,
				fixturesResults,
				leagueName,
				leagueAbbreviation
			});
		}
	};
});
