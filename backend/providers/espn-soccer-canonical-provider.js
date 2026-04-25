const { COMPETITION_KEYS } = require("../../constants/competition-keys.js");
const {
  registerCanonicalProvider
} = require("../canonical-provider-registry.js");
const {
  buildCanonicalGroupedStandingsPayload,
  buildCanonicalStandingsPayload,
  resolveEspnSoccerApiConfig,
  isSupportedGroupedStandingsCompetition,
  isUEFATournamentCompetition
} = require("../slice1-flat-standings.js");
const {
  buildCompetitionCatalogIndex,
  buildCompetitionNavigation,
  getCompetitionCatalogEntry
} = require("../competition-catalog.js");
const { pickPreferredLogo } = require("../utils/logo-helpers");

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

  const rawStats =
    entry.stats &&
    typeof entry.stats === "object" &&
    !Array.isArray(entry.stats)
      ? entry.stats
      : {};
  const goalsFor = rawStats.pointsFor?.value ?? 0;
  const goalsAgainst = rawStats.pointsAgainst?.value ?? 0;
  const goalDiff = rawStats.pointDifferential?.value ?? goalsFor - goalsAgainst;
  const wins = Number(entry.wins) || 0;
  const losses = Number(entry.losses) || 0;
  const ties = Number(entry.ties) || 0;

  return {
    position: entry.rank ?? fallbackPos,
    name: entry.team_name,
    providerId: entry.team_espn_id ? String(entry.team_espn_id) : null,
    logo: pickPreferredLogo(entry.primary_logo, entry.logos, entry.logo),
    played: wins + losses + ties,
    won: wins,
    drawn: ties,
    lost: losses,
    goalsFor: Number(goalsFor) || 0,
    goalsAgainst: Number(goalsAgainst) || 0,
    goalDifference: Number(goalDiff) || 0,
    points: entry.points ?? 0,
    form: Array.isArray(entry.form)
      ? entry.form.map((r) => ({ result: String(r).toUpperCase() }))
      : [],
    abbreviation: entry.team_abbreviation || null,
    zoneLabel: entry.zone_label || null,
    zoneColor: entry.zone_color || null,
    zoneRank: entry.zone_rank || null,
    homeRecord: entry.home_record || null,
    awayRecord: entry.away_record || null,
    streak: entry.streak || null
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
  return String(status || "")
    .trim()
    .toLowerCase();
}

function mapEvent(eventEntry) {
  if (!eventEntry || !eventEntry.home_team || !eventEntry.away_team) {
    return null;
  }

  const home = eventEntry.home_team;
  const away = eventEntry.away_team;

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
    homeScore = Number(eventEntry.home_score) || 0;
    awayScore = Number(eventEntry.away_score) || 0;
    score = `${homeScore} - ${awayScore}`;
  } else if (
    normalizedStatus === "in_progress" ||
    normalizedStatus === "status_in_progress"
  ) {
    live = true;
    displayStatus = statusDetail || "LIVE";
    homeScore = Number(eventEntry.home_score) || 0;
    awayScore = Number(eventEntry.away_score) || 0;
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
    homeTeam: home.display_name || "",
    awayTeam: away.display_name || "",
    homeLogo: pickPreferredLogo(home.primary_logo, home.logos, null) || "",
    awayLogo: pickPreferredLogo(away.primary_logo, away.logos, null) || "",
    homeProviderId: home.espn_id != null ? String(home.espn_id) : null,
    awayProviderId: away.espn_id != null ? String(away.espn_id) : null,
    date,
    time,
    status: displayStatus,
    live,
    score,
    homeScore,
    awayScore,
    location: eventEntry.venue_name || null,
    venue: eventEntry.venue_name || null,
    leg_value: eventEntry.leg_value ?? null,
    series_completed: eventEntry.series_completed ?? null,
    _eventName: eventEntry.name || "",
    _phaseSlug:
      (eventEntry.league_phase && eventEntry.league_phase.slug) || null,
    _phaseSeasonYear:
      (eventEntry.league_phase && eventEntry.league_phase.season_year) || null
  };
}

function parseFixtures(results) {
  return (Array.isArray(results) ? results : []).map(mapEvent).filter(Boolean);
}

// Maps league_phase.slug → internal knockout bucket key (lowercase).
// "GS" is the group-stage sentinel; all other values are knockouts keys.
const WC_PHASE_SLUG_TO_BUCKET = Object.freeze({
  "group-stage": "GS",
  "round-of-32": "rd32",
  "round-of-16": "rd16",
  quarterfinals: "qf",
  semifinals: "sf",
  "3rd-place-match": "tp",
  "3rd-place": "tp", // Qatar 2022 legacy slug
  final: "final"
});

function getWorldCupStageBucket(fixture, teamsByProviderId, teamsByName) {
  // Phase slug from the API is authoritative.
  if (fixture._phaseSlug && WC_PHASE_SLUG_TO_BUCKET[fixture._phaseSlug]) {
    return WC_PHASE_SLUG_TO_BUCKET[fixture._phaseSlug];
  }

  // Group stage: both teams are known group participants.
  const homeTeam =
    teamsByProviderId.get(fixture.homeProviderId) ||
    teamsByName.get(String(fixture.homeTeam || "").toLowerCase()) ||
    null;
  const awayTeam =
    teamsByProviderId.get(fixture.awayProviderId) ||
    teamsByName.get(String(fixture.awayTeam || "").toLowerCase()) ||
    null;
  if (homeTeam && awayTeam) {
    return "GS";
  }

  // Name-based inference for knockout rounds using ESPN's placeholder team names.
  // "Round of 32 1 Winner" playing "Round of 32 2 Winner" → Round of 16 match.
  // Final and 3rd-place inference from "Semifinal Winner" names is intentionally
  // disabled — ESPN pre-populates these fixtures early and they are unreliable.
  const eventName = String(fixture._eventName || "")
    .trim()
    .toLowerCase();
  if (/round of 32.{0,15}winner/i.test(eventName)) return "rd16";
  if (/round of 16.{0,15}winner/i.test(eventName)) return "qf";
  if (/quarterfinal.{0,15}winner/i.test(eventName)) return "sf";

  return null;
}

function buildWorldCupData(standingsData, fixtures) {
  const groups =
    standingsData && standingsData.groups ? standingsData.groups : {};
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

  // Filter to the latest season year to exclude archived tournaments (e.g. Qatar 2022)
  const allFixtures = Array.isArray(fixtures) ? fixtures : [];
  const seasonYears = allFixtures
    .map((f) => f._phaseSeasonYear)
    .filter((y) => Number.isFinite(y) && y > 0);
  const maxSeasonYear = seasonYears.length ? Math.max(...seasonYears) : null;
  const currentFixtures =
    maxSeasonYear != null
      ? allFixtures.filter((f) => f._phaseSeasonYear === maxSeasonYear)
      : allFixtures;

  currentFixtures.forEach((fixture) => {
    const bucket = getWorldCupStageBucket(
      fixture,
      teamsByProviderId,
      teamsByName
    );
    if (bucket == null) {
      return;
    }

    // Backfill logos from fixture data into standing team records.
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

    if (bucket === "GS") {
      fixture.stage = "GS";
      fixture.group = homeTeam?.group || awayTeam?.group || null;
      groupFixtures.push(fixture);
    } else if (knockouts[bucket]) {
      knockouts[bucket].push(fixture);
    }
  });

  [...groupFixtures, ...Object.values(knockouts).flat()].forEach((fixture) => {
    delete fixture.homeProviderId;
    delete fixture.awayProviderId;
    delete fixture._eventName;
    delete fixture._phaseSlug;
    delete fixture._phaseSeasonYear;
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
        catalogCache && now - Number(catalogCache.fetchedAt || 0) < cacheTtlMs;

      if (isFresh && bySlug[normalizedSlug]) {
        return bySlug[normalizedSlug];
      }

      const { baseUrl, timeoutMs } = resolveEspnSoccerApiConfig(request);
      const catalogResponse = await fetchJson(
        `${baseUrl}/api/v1/leagues/?slug=${encodeURIComponent(normalizedSlug)}&limit=1&context=season`,
        timeoutMs
      );
      const catalogIndex = buildCompetitionCatalogIndex(
        collectPages(catalogResponse)
      );
      const entry = getCompetitionCatalogEntry(catalogIndex, normalizedSlug);

      if (catalogCache && typeof catalogCache === "object") {
        if (!catalogCache.bySlug || typeof catalogCache.bySlug !== "object") {
          catalogCache.bySlug = {};
        }
        if (entry) {
          catalogCache.bySlug[normalizedSlug] = entry;
          catalogCache.fetchedAt = now;
        }
      }

      return entry;
    },

    async fetchCompetitionPayload({
      leagueType,
      slug,
      wantsFixtures,
      request
    }) {
      const { baseUrl, timeoutMs } = resolveEspnSoccerApiConfig(request);

      const competitionCatalogEntry = await this.getCompetitionCatalogEntry(
        slug,
        request
      );

      const phases = Array.isArray(competitionCatalogEntry?.phases)
        ? competitionCatalogEntry.phases
        : [];
      const allSeasonYears = phases
        .map((p) => p.seasonYear)
        .filter(Number.isFinite);
      const targetSeasonYear =
        allSeasonYears.length > 0 ? Math.max(...allSeasonYears) : null;

      const standingsResp = await fetchJson(
        `${baseUrl}/api/v1/standings/?league=${slug}&current=true&limit=200`,
        timeoutMs
      );
      const filteredStandings = collectPages(standingsResp);

      const isGrouped = isSupportedGroupedStandingsCompetition(leagueType);
      // Domestic flat leagues (col.1, ger.1, etc.) get simplified 2-tab nav.
      // Grouped (fifa.world) and UEFA tournaments keep their full catalog nav.
      const useFlatTwoTabNav =
        !isGrouped && !isUEFATournamentCompetition(leagueType);

      let fixturesResults = [];
      if (wantsFixtures && competitionCatalogEntry) {
        if (useFlatTwoTabNav) {
          // Domestic flat leagues: rolling 2-week window (14 days back, 14 days ahead).
          // No phase restriction — shows recent results + upcoming fixtures together.
          const today = new Date();
          const pad = (n) => String(n).padStart(2, "0");
          const toDateStr = (d) =>
            `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
          const dateFrom = toDateStr(
            new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000)
          );
          const dateTo = toDateStr(
            new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000)
          );
          const resp = await fetchJson(
            `${baseUrl}/api/v1/fixtures/?league=${slug}&date_from=${dateFrom}&date_to=${dateTo}&upcoming=false&limit=100`,
            timeoutMs
          );
          fixturesResults = collectPages(resp);
        } else {
          // Grouped (World Cup) and UEFA: fetch per phase across the target season.
          const relevantPhases = phases.filter(
            (p) => targetSeasonYear == null || p.seasonYear === targetSeasonYear
          );

          if (relevantPhases.length > 0) {
            const phaseRequests = relevantPhases
              .filter((p) => p.startDate && p.endDate)
              .map((p) => {
                const dateFrom = p.startDate.split("T")[0];
                const dateTo = p.endDate.split("T")[0];
                const url = `${baseUrl}/api/v1/fixtures/?league=${slug}&date_from=${dateFrom}&date_to=${dateTo}&upcoming=false&limit=100`;
                return fetchJson(url, timeoutMs);
              });

            const phaseResponses = await Promise.all(phaseRequests);
            const seenIds = new Set();
            fixturesResults = phaseResponses
              .flatMap((resp) => collectPages(resp))
              .filter((f) => {
                const id =
                  f.id != null
                    ? String(f.id)
                    : [f.date, f.espn_id].filter(Boolean).join("__") || null;
                if (!id) return true;
                if (seenIds.has(id)) return false;
                seenIds.add(id);
                return true;
              });
          } else {
            const seasonParam =
              targetSeasonYear != null ? `&season=${targetSeasonYear}` : "";
            const resp = await fetchJson(
              `${baseUrl}/api/v1/fixtures/?league=${slug}&upcoming=false${seasonParam}&limit=100`,
              timeoutMs
            );
            fixturesResults = collectPages(resp);
          }
        }
      }

      if (filteredStandings.length === 0) {
        throw new Error(
          `No canonical standings data from ESPN Soccer API for ${leagueType}`
        );
      }

      const leagueName =
        (competitionCatalogEntry && competitionCatalogEntry.name) ||
        humanizeSlug(slug) ||
        leagueType;
      const leagueAbbreviation =
        competitionCatalogEntry && competitionCatalogEntry.abbreviation
          ? competitionCatalogEntry.abbreviation
          : null;
      const leagueLogos =
        competitionCatalogEntry && competitionCatalogEntry.logos
          ? competitionCatalogEntry.logos
          : null;

      if (isGrouped) {
        return buildCanonicalGroupedStandingsPayload({
          leagueType,
          slug,
          groupedData: buildWorldCupData(
            parseGroupedStandings(filteredStandings, leagueType),
            parseFixtures(fixturesResults)
          ),
          leagueName,
          leagueAbbreviation,
          leagueLogos,
          competitionNavigation: buildCompetitionNavigation(
            competitionCatalogEntry
          )
        });
      }

      // Domestic flat leagues: 2-tab nav (Table + Fixtures).
      // UEFA tournaments: full catalog navigation (knockout tabs preserved).
      const competitionNavigation = useFlatTwoTabNav
        ? {
            source: "catalog",
            seasonYear: targetSeasonYear,
            subTabs: [
              {
                id: "Table",
                label: null,
                type: "standings",
                seasonYear: targetSeasonYear
              },
              {
                id: "Fixtures",
                label: null,
                type: "fixtures",
                seasonYear: targetSeasonYear
              }
            ]
          }
        : buildCompetitionNavigation(competitionCatalogEntry);

      return buildCanonicalStandingsPayload({
        leagueType,
        slug,
        standingsResults: filteredStandings,
        fixturesResults,
        leagueName,
        leagueAbbreviation,
        leagueLogos,
        competitionNavigation
      });
    }
  };
});
