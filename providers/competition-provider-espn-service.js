(function registerEspnServiceCompetitionProvider(globalScope) {
  function resolveCompetitionKeyForEspn(leagueCode) {
    if (typeof getCompetitionKey === "function") {
      return getCompetitionKey(leagueCode, "espn_service");
    }

    return null;
  }

  function resolveLeagueSlugForEspn(leagueCode) {
    if (!leagueCode || typeof leagueCode !== "string") {
      return null;
    }

    if (typeof getCompetitionValue === "function") {
      const directValue = getCompetitionValue(leagueCode, "espn_service");
      if (typeof directValue === "string" && directValue.trim()) {
        return directValue.trim().toLowerCase();
      }
    }

    const normalizedCode = leagueCode.trim().toLowerCase();
    return normalizedCode.includes(".") ? normalizedCode : null;
  }

  function humanizeLeagueIdentifier(leagueCode) {
    const rawValue =
      resolveLeagueSlugForEspn(leagueCode) ||
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
  }

  function buildLeagueAbbreviation(leagueName) {
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
  }

  globalScope.CompetitionProvider.register("espn_service", {
    providerName: "ESPN Soccer API",

    resolveCompetitionKey(leagueCode) {
      return resolveCompetitionKeyForEspn(leagueCode);
    },

    resolveLeagueSlug(leagueCode) {
      return resolveLeagueSlugForEspn(leagueCode);
    },

    getCompetitionInfo(leagueCode, canonicalPayload) {
      const competition =
        canonicalPayload &&
        canonicalPayload.competition &&
        typeof canonicalPayload.competition === "object"
          ? canonicalPayload.competition
          : null;
      const name =
        competition &&
        typeof competition.name === "string" &&
        competition.name.trim()
          ? competition.name.trim()
          : humanizeLeagueIdentifier(leagueCode);
      const apiAbbreviation =
        competition &&
        typeof competition.abbreviation === "string" &&
        competition.abbreviation.trim()
          ? competition.abbreviation.trim()
          : "";
      const competitionLogos =
        competition &&
        competition.logos &&
        typeof competition.logos === "object"
          ? competition.logos
          : null;
      const preferredLogo =
        competitionLogos &&
        typeof competitionLogos.primary === "string" &&
        competitionLogos.primary.trim()
          ? competitionLogos.primary.trim()
          : competitionLogos &&
              typeof competitionLogos.dark === "string" &&
              competitionLogos.dark.trim()
            ? competitionLogos.dark.trim()
            : competitionLogos &&
                typeof competitionLogos.default === "string" &&
                competitionLogos.default.trim()
              ? competitionLogos.default.trim()
              : null;

      return {
        name,
        abbreviation:
          apiAbbreviation && apiAbbreviation.length <= 10
            ? apiAbbreviation
            : buildLeagueAbbreviation(name),
        logo: preferredLogo,
        logos: competitionLogos
      };
    },

    isFlatCompetition(leagueCode) {
      const competitionKey = resolveCompetitionKeyForEspn(leagueCode);
      return (
        competitionKey === COMPETITION_KEYS.COLOMBIA_PRIMERA ||
        competitionKey === COMPETITION_KEYS.UEFA_CHAMPIONS ||
        competitionKey === COMPETITION_KEYS.UEFA_EUROPA ||
        competitionKey === COMPETITION_KEYS.UEFA_EUROPA_CONFERENCE
      );
    },

    isGroupedCompetition(leagueCode) {
      return (
        resolveCompetitionKeyForEspn(leagueCode) === COMPETITION_KEYS.FIFA_WORLD
      );
    },

    isWorldCupCompetition(leagueCode) {
      return (
        resolveCompetitionKeyForEspn(leagueCode) === COMPETITION_KEYS.FIFA_WORLD
      );
    },

    isUefaTournamentCompetition(leagueCode) {
      const competitionKey = resolveCompetitionKeyForEspn(leagueCode);
      return (
        competitionKey === COMPETITION_KEYS.UEFA_CHAMPIONS ||
        competitionKey === COMPETITION_KEYS.UEFA_EUROPA ||
        competitionKey === COMPETITION_KEYS.UEFA_EUROPA_CONFERENCE
      );
    },

    getPreferredWorldCupLeagueCode(codes) {
      const candidates = Array.isArray(codes) ? codes : [];
      const existingWorldCupCode = candidates.find((code) =>
        this.isWorldCupCompetition(code)
      );
      if (existingWorldCupCode) {
        return existingWorldCupCode;
      }

      return resolveLeagueSlugForEspn(COMPETITION_KEYS.FIFA_WORLD);
    }
  });
})(globalThis);
