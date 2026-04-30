(function registerCanonicalViewAdapter(globalScope) {
  function buildFixtureViewModel(fixture) {
    const kickoffDate = new Date(fixture && fixture.kickoff);
    const status = (fixture && fixture.status) || "unknown";
    const hasKickoff = !Number.isNaN(kickoffDate.getTime());

    return {
      id: fixture && fixture.id ? fixture.id : null,
      homeTeam:
        fixture && fixture.home && fixture.home.name ? fixture.home.name : "",
      awayTeam:
        fixture && fixture.away && fixture.away.name ? fixture.away.name : "",
      homeLogo:
        fixture &&
        fixture.home &&
        fixture.home.logos &&
        fixture.home.logos.primary
          ? fixture.home.logos.primary
          : "",
      awayLogo:
        fixture &&
        fixture.away &&
        fixture.away.logos &&
        fixture.away.logos.primary
          ? fixture.away.logos.primary
          : "",
      date: hasKickoff
        ? `${kickoffDate.getFullYear()}-${String(
            kickoffDate.getMonth() + 1
          ).padStart(2, "0")}-${String(kickoffDate.getDate()).padStart(2, "0")}`
        : "",
      time: hasKickoff
        ? `${String(kickoffDate.getHours()).padStart(2, "0")}:${String(
            kickoffDate.getMinutes()
          ).padStart(2, "0")}`
        : "",
      timestamp: hasKickoff ? kickoffDate.getTime() : null,
      status:
        status === "in_progress"
          ? fixture.statusLabel || fixture.clock || "LIVE"
          : status === "final"
            ? fixture.statusLabel || "FT"
            : status === "postponed"
              ? "PST"
              : status === "cancelled"
                ? "CANC"
                : "",
      live: status === "in_progress",
      score:
        fixture &&
        fixture.score &&
        fixture.score.home != null &&
        fixture.score.away != null
          ? `${fixture.score.home} - ${fixture.score.away}`
          : "vs",
      homeScore:
        fixture && fixture.score && fixture.score.home != null
          ? fixture.score.home
          : undefined,
      awayScore:
        fixture && fixture.score && fixture.score.away != null
          ? fixture.score.away
          : undefined,
      venue:
        fixture && fixture.venue && fixture.venue.name
          ? fixture.venue.name
          : "",
      location:
        fixture && fixture.venue && fixture.venue.name
          ? fixture.venue.name
          : "",
      stage: fixture && fixture.stage ? fixture.stage : null,
      group:
        fixture && fixture.group
          ? fixture.group
          : fixture && fixture.stage === "GS" && fixture.group
            ? fixture.group
            : null,
      aggregateScore:
        fixture &&
        (fixture.legValue === 2 || fixture.seriesCompleted) &&
        fixture.aggregateScore &&
        fixture.aggregateScore.home != null &&
        fixture.aggregateScore.away != null
          ? `${fixture.aggregateScore.home} - ${fixture.aggregateScore.away}`
          : null,
      isSecondLeg: !!(fixture && fixture.legValue === 2),
      seriesCompleted: !!(fixture && fixture.seriesCompleted)
    };
  }

  function getSource(payload) {
    return (
      (payload &&
        payload.state &&
        (payload.state.providerName || payload.state.providerId)) ||
      "ESPN Soccer API"
    );
  }

  function getUpdatedAt(payload) {
    return (
      (payload && payload.generatedAt) ||
      (payload && payload.standings && payload.standings.updatedAt) ||
      new Date().toISOString()
    );
  }

  globalScope.CanonicalViewAdapter = {
    buildStandingsViewModel(payload, currentLeague) {
      const rows =
        payload && payload.standings && Array.isArray(payload.standings.rows)
          ? payload.standings.rows
          : [];
      const source = getSource(payload);
      const updatedAt = getUpdatedAt(payload);

      return {
        leagueType:
          (payload &&
            payload.competition &&
            (payload.competition.slug || payload.competition.code)) ||
          currentLeague,
        competitionName:
          payload && payload.competition && payload.competition.name
            ? payload.competition.name
            : null,
        competitionAbbreviation:
          payload && payload.competition && payload.competition.abbreviation
            ? payload.competition.abbreviation
            : null,
        source,
        meta: {
          lastUpdated: updatedAt,
          source
        },
        teams: rows.map((row) => ({
          position: row.rank,
          name: row.team && row.team.name ? row.team.name : "Unknown Team",
          logo:
            row.team && row.team.logos && row.team.logos.primary
              ? row.team.logos.primary
              : null,
          played:
            row.metrics && Number.isFinite(row.metrics.played)
              ? row.metrics.played
              : null,
          won:
            row.metrics && Number.isFinite(row.metrics.wins)
              ? row.metrics.wins
              : null,
          drawn:
            row.metrics && Number.isFinite(row.metrics.draws)
              ? row.metrics.draws
              : null,
          lost:
            row.metrics && Number.isFinite(row.metrics.losses)
              ? row.metrics.losses
              : null,
          goalsFor:
            row.metrics && Number.isFinite(row.metrics.goalsFor)
              ? row.metrics.goalsFor
              : null,
          goalsAgainst:
            row.metrics && Number.isFinite(row.metrics.goalsAgainst)
              ? row.metrics.goalsAgainst
              : null,
          goalDifference:
            row.metrics && Number.isFinite(row.metrics.goalDifference)
              ? row.metrics.goalDifference
              : null,
          points:
            row.metrics && Number.isFinite(row.metrics.points)
              ? row.metrics.points
              : null,
          form: Array.isArray(row.form) ? row.form : []
        })),
        fixtures:
          payload && payload.fixtures && Array.isArray(payload.fixtures.items)
            ? payload.fixtures.items.map(buildFixtureViewModel)
            : []
      };
    },

    buildGroupedStandingsViewModel(payload, currentLeague) {
      const source = getSource(payload);
      const updatedAt = getUpdatedAt(payload);
      const groups = {};
      (payload && payload.standings && Array.isArray(payload.standings.groups)
        ? payload.standings.groups
        : []
      ).forEach((groupEntry) => {
        if (!groupEntry || !groupEntry.id) {
          return;
        }

        groups[groupEntry.id] = (
          Array.isArray(groupEntry.rows) ? groupEntry.rows : []
        ).map((row) => ({
          position: row.rank,
          name: row.team && row.team.name ? row.team.name : "Unknown Team",
          logo:
            row.team && row.team.logos && row.team.logos.primary
              ? row.team.logos.primary
              : null,
          played:
            row.metrics && Number.isFinite(row.metrics.played)
              ? row.metrics.played
              : null,
          won:
            row.metrics && Number.isFinite(row.metrics.wins)
              ? row.metrics.wins
              : null,
          drawn:
            row.metrics && Number.isFinite(row.metrics.draws)
              ? row.metrics.draws
              : null,
          lost:
            row.metrics && Number.isFinite(row.metrics.losses)
              ? row.metrics.losses
              : null,
          goalsFor:
            row.metrics && Number.isFinite(row.metrics.goalsFor)
              ? row.metrics.goalsFor
              : null,
          goalsAgainst:
            row.metrics && Number.isFinite(row.metrics.goalsAgainst)
              ? row.metrics.goalsAgainst
              : null,
          goalDifference:
            row.metrics && Number.isFinite(row.metrics.goalDifference)
              ? row.metrics.goalDifference
              : null,
          points:
            row.metrics && Number.isFinite(row.metrics.points)
              ? row.metrics.points
              : null,
          form: Array.isArray(row.form) ? row.form : []
        }));
      });

      const knockouts = {};
      const canonicalKnockouts =
        payload && payload.knockouts && typeof payload.knockouts === "object"
          ? payload.knockouts
          : {};
      Object.keys(canonicalKnockouts).forEach((stageKey) => {
        knockouts[stageKey] = (
          Array.isArray(canonicalKnockouts[stageKey])
            ? canonicalKnockouts[stageKey]
            : []
        ).map(buildFixtureViewModel);
      });

      return {
        leagueType:
          (payload &&
            payload.competition &&
            (payload.competition.slug || payload.competition.code)) ||
          currentLeague,
        competitionName:
          payload && payload.competition && payload.competition.name
            ? payload.competition.name
            : null,
        competitionAbbreviation:
          payload && payload.competition && payload.competition.abbreviation
            ? payload.competition.abbreviation
            : null,
        source,
        lastUpdated: updatedAt,
        meta: {
          lastUpdated: updatedAt,
          source
        },
        groups,
        fixtures:
          payload && payload.fixtures && Array.isArray(payload.fixtures.items)
            ? payload.fixtures.items.map(buildFixtureViewModel)
            : [],
        knockouts
      };
    }
  };
})(globalThis);
