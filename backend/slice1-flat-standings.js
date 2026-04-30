const {
  COMPETITION_KEYS,
  getCompetitionKey,
  getCompetitionValue
} = require("../constants/competition-keys.js");
const { pickPreferredLogo } = require("./utils/logo-helpers");

const SUPPORTED_FLAT_STANDINGS = Object.freeze({
  [COMPETITION_KEYS.COLOMBIA_PRIMERA]: getCompetitionValue(
    COMPETITION_KEYS.COLOMBIA_PRIMERA,
    "espn_service"
  ),
  [COMPETITION_KEYS.UEFA_CHAMPIONS]: getCompetitionValue(
    COMPETITION_KEYS.UEFA_CHAMPIONS,
    "espn_service"
  ),
  [COMPETITION_KEYS.UEFA_EUROPA]: getCompetitionValue(
    COMPETITION_KEYS.UEFA_EUROPA,
    "espn_service"
  ),
  [COMPETITION_KEYS.UEFA_EUROPA_CONFERENCE]: getCompetitionValue(
    COMPETITION_KEYS.UEFA_EUROPA_CONFERENCE,
    "espn_service"
  )
});

const SUPPORTED_GROUPED_STANDINGS = Object.freeze({
  [COMPETITION_KEYS.FIFA_WORLD]: getCompetitionValue(
    COMPETITION_KEYS.FIFA_WORLD,
    "espn_service"
  )
});

function normalizeCompetitionKey(leagueType) {
  if (typeof leagueType !== "string" || !leagueType.trim()) {
    return null;
  }

  return getCompetitionKey(leagueType, "espn_service") || leagueType.trim();
}

function isSupportedFlatStandingsCompetition(leagueType) {
  return Object.prototype.hasOwnProperty.call(
    SUPPORTED_FLAT_STANDINGS,
    normalizeCompetitionKey(leagueType)
  );
}

function isSupportedGroupedStandingsCompetition(leagueType) {
  return Object.prototype.hasOwnProperty.call(
    SUPPORTED_GROUPED_STANDINGS,
    normalizeCompetitionKey(leagueType)
  );
}

function isUEFATournamentCompetition(leagueType) {
  const key = normalizeCompetitionKey(leagueType);
  return (
    key === COMPETITION_KEYS.UEFA_CHAMPIONS ||
    key === COMPETITION_KEYS.UEFA_EUROPA ||
    key === COMPETITION_KEYS.UEFA_EUROPA_CONFERENCE
  );
}

function isSupportedCanonicalCompetition(leagueType) {
  return (
    isSupportedFlatStandingsCompetition(leagueType) ||
    isSupportedGroupedStandingsCompetition(leagueType)
  );
}

function getDefaultSlug(leagueType) {
  const competitionKey = normalizeCompetitionKey(leagueType);
  return (
    SUPPORTED_FLAT_STANDINGS[competitionKey] ||
    SUPPORTED_GROUPED_STANDINGS[competitionKey] ||
    null
  );
}

function resolveEspnSoccerApiConfig(config) {
  const providerSettings =
    (config &&
      config.providerSettings &&
      config.providerSettings.espn_service) ||
    {};
  const baseUrl =
    typeof providerSettings.baseUrl === "string" &&
    providerSettings.baseUrl.trim()
      ? providerSettings.baseUrl.trim().replace(/\/+$/, "")
      : "";
  const timeoutMs =
    Number.isFinite(providerSettings.timeoutMs) &&
    providerSettings.timeoutMs > 0
      ? providerSettings.timeoutMs
      : 8000;

  return { baseUrl, timeoutMs };
}

function buildCanonicalCacheKey(leagueType, surfaces = {}) {
  const competitionKey = normalizeCompetitionKey(leagueType) || leagueType;
  const surfaceKey = surfaces.fixtures ? "standings_fixtures" : "standings";
  return `canonical_${competitionKey}_${surfaceKey}`;
}

// Maps league_phase.slug → canonical fixture stage ID for UEFA tournaments.
const UEFA_PHASE_SLUG_TO_STAGE = Object.freeze({
  "league-phase": null, // standings-only phase; fixtures here have no knockout tab
  "knockout-round-playoffs": "Playoff",
  "round-of-16": "Rd16",
  quarterfinals: "QF",
  semifinals: "SF",
  final: "Final"
});

function inferEspnFixtureStage(leagueType, event) {
  const competitionKey = normalizeCompetitionKey(leagueType);
  if (
    competitionKey !== COMPETITION_KEYS.UEFA_CHAMPIONS &&
    competitionKey !== COMPETITION_KEYS.UEFA_EUROPA &&
    competitionKey !== COMPETITION_KEYS.UEFA_EUROPA_CONFERENCE
  ) {
    return null;
  }

  // Prefer league_phase.slug from the API — authoritative, no fragile name matching.
  const phaseSlug =
    event && event.league_phase && typeof event.league_phase.slug === "string"
      ? event.league_phase.slug.trim().toLowerCase()
      : null;

  if (
    phaseSlug &&
    Object.prototype.hasOwnProperty.call(UEFA_PHASE_SLUG_TO_STAGE, phaseSlug)
  ) {
    return UEFA_PHASE_SLUG_TO_STAGE[phaseSlug];
  }

  // Fallback: name-based inference for older fixtures lacking league_phase data.
  const eventName = String((event && event.name) || "")
    .trim()
    .toLowerCase();
  if (!eventName) {
    return null;
  }

  if (/quarterfinal\s+\d+\s+winner/.test(eventName)) {
    return "SF";
  }
  if (/round of 16\s+\d+\s+winner/.test(eventName)) {
    return "QF";
  }
  if (/playoff\s+\d+\s+winner/.test(eventName)) {
    return "Rd16";
  }
  // "Semifinal X Winner" inference to "Final" is intentionally disabled.
  // ESPN pre-populates final fixtures with placeholder team names before semis are played,
  // making name-based inference unreliable for this stage.

  return null;
}

function normalizeForm(form) {
  if (!Array.isArray(form)) return [];

  return form
    .map((entry) => {
      if (typeof entry === "string" && entry.trim()) {
        return { result: entry.trim().toUpperCase() };
      }
      if (
        entry &&
        typeof entry === "object" &&
        typeof entry.result === "string" &&
        entry.result.trim()
      ) {
        return { result: entry.result.trim().toUpperCase() };
      }
      return null;
    })
    .filter(Boolean);
}

function toStatsMap(entry) {
  const statsMap = {};
  const stats = entry && entry.stats;
  if (stats && typeof stats === "object" && !Array.isArray(stats)) {
    Object.entries(stats).forEach(([key, val]) => {
      statsMap[key] =
        val && typeof val === "object" && "value" in val ? val.value : val;
    });
  } else if (Array.isArray(stats)) {
    stats.forEach((stat) => {
      if (stat && stat.name != null) {
        statsMap[stat.name] = stat.value;
      }
    });
  }
  return statsMap;
}

function filterToLatestSeasonRows(standingsResults) {
  if (!Array.isArray(standingsResults) || standingsResults.length === 0) {
    return [];
  }

  const seasonYears = standingsResults
    .map((entry) => Number(entry && entry.season_year))
    .filter(Number.isFinite);
  if (seasonYears.length === 0) {
    return standingsResults;
  }

  const latestSeasonYear = Math.max(...seasonYears);
  const latestSeasonRows = standingsResults.filter(
    (entry) => Number(entry && entry.season_year) === latestSeasonYear
  );

  const seasonTypes = latestSeasonRows
    .map((entry) => Number(entry && entry.season_type))
    .filter(Number.isFinite);
  if (seasonTypes.length === 0) {
    return latestSeasonRows;
  }

  const primarySeasonType = Math.min(...seasonTypes);
  return latestSeasonRows.filter(
    (entry) => Number(entry && entry.season_type) === primarySeasonType
  );
}

function getNumericScore(value) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeFixtureStatus(status) {
  switch (status) {
    case "scheduled":
      return "scheduled";
    case "in_progress":
      return "in_progress";
    case "final":
      return "final";
    case "postponed":
      return "postponed";
    case "cancelled":
      return "cancelled";
    default:
      return "unknown";
  }
}

function buildCanonicalFixtures(fixturesResults, updatedAt, leagueType = null) {
  if (!Array.isArray(fixturesResults)) {
    return null;
  }

  const items = fixturesResults
    .map((event) => {
      if (!event || !event.home_team || !event.away_team) return null;

      const homeTeam = event.home_team;
      const awayTeam = event.away_team;

      const status = normalizeFixtureStatus(event.status);
      const nonStarted =
        status === "scheduled" ||
        status === "postponed" ||
        status === "cancelled";
      const homeScore = nonStarted ? null : getNumericScore(event.home_score);
      const awayScore = nonStarted ? null : getNumericScore(event.away_score);

      const homeWinner = event.winner_side === "home";
      const awayWinner = event.winner_side === "away";

      return {
        id: event.id != null ? String(event.id) : null,
        providerId: event.espn_id ? String(event.espn_id) : null,
        name: event.name || null,
        shortName: event.short_name || null,
        kickoff: event.date,
        status,
        statusLabel: event.status_detail || null,
        clock: event.clock == null ? null : String(event.clock),
        period: Number.isFinite(event.period) ? event.period : null,
        leagueSlug: event.league_slug || null,
        stage: inferEspnFixtureStage(leagueType, event),
        group: null,
        venue: {
          name: event.venue_name || null,
          city: null,
          country: null
        },
        home: {
          id: null,
          providerId:
            homeTeam.espn_id != null ? String(homeTeam.espn_id) : null,
          slug: null,
          name: homeTeam.display_name || homeTeam.name || "Unknown Team",
          shortName:
            homeTeam.short_display_name || homeTeam.display_name || null,
          abbreviation: homeTeam.abbreviation || null,
          location: homeTeam.location || null,
          colors: {
            primary: homeTeam.color || null,
            secondary: homeTeam.alternate_color || null
          },
          logos: {
            primary: pickPreferredLogo(
              homeTeam.primary_logo,
              homeTeam.logos,
              homeTeam.logo
            ),
            dark: null,
            light: null
          },
          isActive: null
        },
        away: {
          id: null,
          providerId:
            awayTeam.espn_id != null ? String(awayTeam.espn_id) : null,
          slug: null,
          name: awayTeam.display_name || awayTeam.name || "Unknown Team",
          shortName:
            awayTeam.short_display_name || awayTeam.display_name || null,
          abbreviation: awayTeam.abbreviation || null,
          location: awayTeam.location || null,
          colors: {
            primary: awayTeam.color || null,
            secondary: awayTeam.alternate_color || null
          },
          logos: {
            primary: pickPreferredLogo(
              awayTeam.primary_logo,
              awayTeam.logos,
              awayTeam.logo
            ),
            dark: null,
            light: null
          },
          isActive: null
        },
        score: {
          home: homeScore,
          away: awayScore,
          decided: status === "final"
        },
        outcome: {
          winnerSide:
            status === "final"
              ? homeWinner
                ? "home"
                : awayWinner
                  ? "away"
                  : "draw"
              : null
        },
        legValue:
          event.leg_value != null ? Number(event.leg_value) || null : null,
        seriesCompleted: event.series_completed ?? null,
        aggregateScore:
          event.home_aggregate_score != null &&
          event.away_aggregate_score != null
            ? {
                home: Number(event.home_aggregate_score),
                away: Number(event.away_aggregate_score)
              }
            : null
      };
    })
    .filter(Boolean)
    .sort((left, right) => {
      const t = (f) => (f.kickoff ? new Date(f.kickoff).getTime() : Infinity);
      return t(left) - t(right);
    });

  return {
    updatedAt,
    stale: false,
    filters: {
      upcoming: false,
      status: null,
      dateFrom: null,
      dateTo: null
    },
    items
  };
}

function buildTeamLogoIndexFromFixtures(fixtures) {
  const logoIndex = new Map();
  if (!fixtures || !Array.isArray(fixtures.items)) {
    return logoIndex;
  }

  fixtures.items.forEach((fixture) => {
    [fixture && fixture.home, fixture && fixture.away].forEach((team) => {
      const providerId =
        team && team.providerId ? String(team.providerId) : null;
      const primaryLogo =
        team && team.logos && typeof team.logos.primary === "string"
          ? team.logos.primary
          : null;
      if (providerId && primaryLogo && !logoIndex.has(providerId)) {
        logoIndex.set(providerId, primaryLogo);
      }
    });
  });

  return logoIndex;
}

function normalizeCompetitionLogos(logos) {
  if (!logos || typeof logos !== "object") {
    return null;
  }

  const primary =
    typeof logos.primary === "string" && logos.primary.trim()
      ? logos.primary.trim()
      : null;
  const dark =
    typeof logos.dark === "string" && logos.dark.trim()
      ? logos.dark.trim()
      : null;
  const defaultLogo =
    typeof logos.default === "string" && logos.default.trim()
      ? logos.default.trim()
      : null;
  const light =
    typeof logos.light === "string" && logos.light.trim()
      ? logos.light.trim()
      : null;

  if (!primary && !dark && !defaultLogo && !light) {
    return null;
  }

  return {
    primary,
    dark,
    default: defaultLogo,
    light
  };
}

function buildCanonicalStandingsPayload({
  leagueType,
  slug,
  standingsResults,
  fixturesResults = null,
  leagueName,
  leagueAbbreviation = null,
  leagueLogos = null,
  competitionNavigation = null,
  stale = false,
  warnings = []
}) {
  const competitionKey = normalizeCompetitionKey(leagueType) || leagueType;
  const competitionSlug = slug || getDefaultSlug(competitionKey);
  const filteredRows = filterToLatestSeasonRows(standingsResults);
  const generatedAt = new Date().toISOString();
  const firstRow = filteredRows[0] || {};
  const fixtures = buildCanonicalFixtures(
    fixturesResults,
    generatedAt,
    competitionKey
  );
  const teamLogoIndex = buildTeamLogoIndexFromFixtures(fixtures);
  const hasFixtures =
    fixtures && Array.isArray(fixtures.items) && fixtures.items.length > 0;

  const rows = filteredRows
    .map((entry, index) => {
      if (!entry || !entry.team_name) return null;

      const statsMap = toStatsMap(entry);
      const wins = Number(entry.wins) || 0;
      const losses = Number(entry.losses) || 0;
      const draws = Number(entry.ties) || 0;
      const goalsFor =
        statsMap.pointsFor == null ? null : Number(statsMap.pointsFor);
      const goalsAgainst =
        statsMap.pointsAgainst == null ? null : Number(statsMap.pointsAgainst);
      const goalDifference =
        statsMap.pointDifferential == null
          ? goalsFor != null && goalsAgainst != null
            ? goalsFor - goalsAgainst
            : null
          : Number(statsMap.pointDifferential);

      return {
        rank: Number(entry.rank) || index + 1,
        group: entry.group_name || null,
        team: {
          id: null,
          providerId: entry.team_espn_id ? String(entry.team_espn_id) : null,
          slug: null,
          name: entry.team_name,
          shortName: entry.team_name,
          abbreviation: entry.team_abbreviation || null,
          location: null,
          colors: {
            primary: null,
            secondary: null
          },
          logos: {
            primary:
              pickPreferredLogo(entry.primary_logo, entry.logos, entry.logo) ||
              (entry.team_espn_id != null
                ? teamLogoIndex.get(String(entry.team_espn_id)) || null
                : null),
            dark: null,
            light: null
          },
          isActive: null
        },
        metrics: {
          played: wins + losses + draws,
          wins,
          draws,
          losses,
          points: Number(entry.points) || 0,
          goalsFor,
          goalsAgainst,
          goalDifference,
          gamesBehind:
            entry.games_behind == null ? null : Number(entry.games_behind),
          winPct: entry.win_pct == null ? null : Number(entry.win_pct),
          homeRecord: entry.home_record || null,
          awayRecord: entry.away_record || null,
          streak: entry.streak || null,
          stats: Array.isArray(entry.stats) ? entry.stats : []
        },
        form: normalizeForm(entry.last_3_form || entry.form),
        zone: {
          label: entry.zone_label || null,
          color: entry.zone_color || null,
          rank: entry.zone_rank == null ? null : Number(entry.zone_rank)
        }
      };
    })
    .filter(Boolean);

  return {
    schemaVersion: "0.1.0",
    generatedAt,
    competition: {
      code: competitionKey,
      slug: competitionSlug,
      name: leagueName || competitionKey,
      abbreviation: leagueAbbreviation,
      logos: normalizeCompetitionLogos(leagueLogos),
      navigation:
        competitionNavigation && Array.isArray(competitionNavigation.subTabs)
          ? competitionNavigation
          : null,
      seasonYear: firstRow.season_year || null,
      seasonType: firstRow.season_type || null,
      grouped: false,
      provider: {
        id: "espn-soccer-api",
        name: "ESPN Soccer API"
      },
      capabilities: {
        standings: true,
        fixtures: hasFixtures,
        groupedStandings: false,
        knockouts: false,
        zones: true,
        form: true
      }
    },
    state: {
      status:
        rows.length === 0 && !hasFixtures ? "empty" : stale ? "stale" : "ready",
      stale,
      partial: false,
      providerId: "espn-soccer-api",
      providerName: "ESPN Soccer API",
      lastUpdated: generatedAt,
      message: null,
      errorCode: null,
      warnings: Array.isArray(warnings) ? warnings : []
    },
    standings: {
      kind: "flat",
      updatedAt: generatedAt,
      stale,
      rows
    },
    fixtures
  };
}

function buildCanonicalFixtureFromLegacyFixture(fixture, overrideStage = null) {
  if (!fixture || !fixture.homeTeam || !fixture.awayTeam) {
    return null;
  }

  const kickoff =
    fixture.date && fixture.time
      ? new Date(`${fixture.date}T${fixture.time}:00Z`)
      : fixture.date
        ? new Date(`${fixture.date}T00:00:00Z`)
        : null;
  const kickoffIso =
    kickoff && !Number.isNaN(kickoff.getTime()) ? kickoff.toISOString() : null;
  const homeScore = getNumericScore(fixture.homeScore);
  const awayScore = getNumericScore(fixture.awayScore);
  const status =
    fixture.live === true
      ? "in_progress"
      : fixture.status === "FT" ||
          fixture.status === "AET" ||
          fixture.status === "PEN" ||
          fixture.status === "PENS"
        ? "final"
        : fixture.status === "PST"
          ? "postponed"
          : fixture.status === "CANC"
            ? "cancelled"
            : "scheduled";

  return {
    id:
      fixture.id ||
      [
        fixture.date || "unknown-date",
        fixture.homeTeam,
        fixture.awayTeam,
        overrideStage || fixture.stage || fixture.group || "fixture"
      ].join(":"),
    stage: overrideStage || fixture.stage || null,
    group: fixture.group || null,
    kickoff: kickoffIso,
    status,
    statusLabel: fixture.status || null,
    clock: fixture.live ? fixture.status || "LIVE" : null,
    venue: {
      name: fixture.location || fixture.venue || null,
      city: null,
      country: null
    },
    home: {
      id: null,
      providerId: null,
      name: fixture.homeTeam,
      shortName: fixture.homeTeam,
      abbreviation: null,
      logos: {
        primary: fixture.homeLogo || null,
        dark: null,
        light: null
      }
    },
    away: {
      id: null,
      providerId: null,
      name: fixture.awayTeam,
      shortName: fixture.awayTeam,
      abbreviation: null,
      logos: {
        primary: fixture.awayLogo || null,
        dark: null,
        light: null
      }
    },
    score: {
      home: homeScore,
      away: awayScore,
      decided: status === "final"
    },
    outcome: {
      winnerSide:
        status !== "final" || homeScore == null || awayScore == null
          ? null
          : homeScore > awayScore
            ? "home"
            : awayScore > homeScore
              ? "away"
              : "draw"
    }
  };
}

function buildCanonicalGroupedStandingsPayload({
  leagueType,
  slug,
  groupedData,
  leagueName,
  leagueAbbreviation = null,
  leagueLogos = null,
  competitionNavigation = null,
  stale = false,
  warnings = []
}) {
  const competitionKey = normalizeCompetitionKey(leagueType) || leagueType;
  const competitionSlug = slug || getDefaultSlug(competitionKey);
  const generatedAt = new Date().toISOString();
  const groupsSource =
    groupedData && groupedData.groups && typeof groupedData.groups === "object"
      ? groupedData.groups
      : {};
  const groups = Object.entries(groupsSource)
    .sort(([leftId], [rightId]) => leftId.localeCompare(rightId))
    .map(([groupId, teams]) => ({
      id: groupId,
      label: `Group ${groupId}`,
      rows: (Array.isArray(teams) ? teams : [])
        .map((team, index) => ({
          rank:
            team && Number.isFinite(Number(team.position))
              ? Number(team.position)
              : index + 1,
          group: groupId,
          team: {
            id: null,
            providerId: null,
            slug: null,
            name: team && team.name ? team.name : "Unknown Team",
            shortName: team && team.name ? team.name : "Unknown Team",
            abbreviation: null,
            location: null,
            colors: {
              primary: null,
              secondary: null
            },
            logos: {
              primary: team && team.logo ? team.logo : null,
              dark: null,
              light: null
            },
            isActive: null
          },
          metrics: {
            played:
              team && Number.isFinite(Number(team.played))
                ? Number(team.played)
                : null,
            wins:
              team && Number.isFinite(Number(team.won))
                ? Number(team.won)
                : null,
            draws:
              team && Number.isFinite(Number(team.drawn))
                ? Number(team.drawn)
                : null,
            losses:
              team && Number.isFinite(Number(team.lost))
                ? Number(team.lost)
                : null,
            points:
              team && Number.isFinite(Number(team.points))
                ? Number(team.points)
                : null,
            goalsFor:
              team && Number.isFinite(Number(team.goalsFor))
                ? Number(team.goalsFor)
                : null,
            goalsAgainst:
              team && Number.isFinite(Number(team.goalsAgainst))
                ? Number(team.goalsAgainst)
                : null,
            goalDifference:
              team && Number.isFinite(Number(team.goalDifference))
                ? Number(team.goalDifference)
                : null,
            gamesBehind: null,
            winPct: null,
            homeRecord: null,
            awayRecord: null,
            streak: null,
            stats: []
          },
          form: normalizeForm(team && team.form),
          zone: {
            label: null,
            color: null,
            rank: null
          }
        }))
        .filter(Boolean)
    }));
  const fixtureItems = (
    Array.isArray(groupedData && groupedData.fixtures)
      ? groupedData.fixtures
      : []
  )
    .map((fixture) => buildCanonicalFixtureFromLegacyFixture(fixture))
    .filter(Boolean);
  const knockouts = {};
  Object.entries(
    groupedData &&
      groupedData.knockouts &&
      typeof groupedData.knockouts === "object"
      ? groupedData.knockouts
      : {}
  ).forEach(([stageKey, fixtures]) => {
    knockouts[stageKey] = (Array.isArray(fixtures) ? fixtures : [])
      .map((fixture) =>
        buildCanonicalFixtureFromLegacyFixture(fixture, stageKey)
      )
      .filter(Boolean);
  });
  const totalRows = groups.reduce(
    (sum, groupEntry) => sum + groupEntry.rows.length,
    0
  );
  const hasKnockouts = Object.values(knockouts).some(
    (fixtures) => Array.isArray(fixtures) && fixtures.length > 0
  );

  return {
    schemaVersion: "0.1.0",
    generatedAt,
    competition: {
      code: competitionKey,
      slug: competitionSlug,
      name: leagueName || competitionKey,
      abbreviation: leagueAbbreviation,
      logos: normalizeCompetitionLogos(leagueLogos),
      navigation:
        competitionNavigation && Array.isArray(competitionNavigation.subTabs)
          ? competitionNavigation
          : null,
      seasonYear: null,
      seasonType: null,
      grouped: true,
      provider: {
        id: "espn-soccer-api",
        name: "ESPN Soccer API"
      },
      capabilities: {
        standings: true,
        fixtures: fixtureItems.length > 0,
        groupedStandings: true,
        knockouts: hasKnockouts,
        zones: false,
        form: true
      }
    },
    state: {
      status:
        totalRows === 0 && fixtureItems.length === 0 && !hasKnockouts
          ? "empty"
          : stale
            ? "stale"
            : "ready",
      stale,
      partial: false,
      providerId: "espn-soccer-api",
      providerName: "ESPN Soccer API",
      lastUpdated: generatedAt,
      message: null,
      errorCode: null,
      warnings: Array.isArray(warnings) ? warnings : []
    },
    standings: {
      kind: "grouped",
      updatedAt: generatedAt,
      stale,
      groups
    },
    fixtures: {
      updatedAt: generatedAt,
      stale,
      filters: {
        upcoming: false,
        status: null,
        dateFrom: null,
        dateTo: null
      },
      items: fixtureItems
    },
    knockouts
  };
}

module.exports = {
  SUPPORTED_FLAT_STANDINGS,
  SUPPORTED_GROUPED_STANDINGS,
  buildCanonicalCacheKey,
  buildCanonicalGroupedStandingsPayload,
  buildCanonicalStandingsPayload,
  buildCanonicalFixtures,
  filterToLatestSeasonRows,
  getDefaultSlug,
  normalizeCompetitionKey,
  isSupportedCanonicalCompetition,
  isSupportedFlatStandingsCompetition,
  isSupportedGroupedStandingsCompetition,
  isUEFATournamentCompetition,
  resolveEspnSoccerApiConfig
};
