function getFirstLogoHref(logos, predicate = null) {
  return (Array.isArray(logos) ? logos : [])
    .map((logoEntry) => {
      if (
        !logoEntry ||
        typeof logoEntry.href !== "string" ||
        !logoEntry.href.trim()
      ) {
        return null;
      }

      return {
        href: logoEntry.href.trim(),
        rel: Array.isArray(logoEntry.rel)
          ? logoEntry.rel.map((value) => String(value).toLowerCase())
          : []
      };
    })
    .filter(Boolean)
    .find((logoEntry) =>
      typeof predicate === "function" ? predicate(logoEntry) : true
    )?.href;
}

function normalizeCompetitionLogos(primaryLogo, logos) {
  const explicitPrimary =
    typeof primaryLogo === "string" && primaryLogo.trim()
      ? primaryLogo.trim()
      : null;
  const dark = getFirstLogoHref(logos, (logoEntry) =>
    logoEntry.rel.includes("dark")
  );
  const defaultLogo =
    getFirstLogoHref(logos, (logoEntry) => logoEntry.rel.includes("default")) ||
    getFirstLogoHref(logos);
  const light = getFirstLogoHref(logos, (logoEntry) =>
    logoEntry.rel.includes("light")
  );

  if (!explicitPrimary && !dark && !defaultLogo && !light) {
    return null;
  }

  return {
    primary: explicitPrimary,
    dark: dark || null,
    default: defaultLogo || null,
    light: light || null
  };
}

function normalizeCatalogDate(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeCatalogString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function compareNullableNumbers(left, right) {
  const leftNumber = Number(left);
  const rightNumber = Number(right);
  const leftFinite = Number.isFinite(leftNumber);
  const rightFinite = Number.isFinite(rightNumber);

  if (leftFinite && rightFinite && leftNumber !== rightNumber) {
    return leftNumber - rightNumber;
  }
  if (leftFinite !== rightFinite) {
    return leftFinite ? -1 : 1;
  }

  return 0;
}

function compareNullableStrings(left, right) {
  return String(left || "").localeCompare(String(right || ""));
}

function normalizeCompetitionPhases(phases) {
  return (Array.isArray(phases) ? phases : [])
    .map((phase) => {
      if (!phase || (!phase.id && !phase.slug && !phase.name)) {
        return null;
      }

      return {
        id: phase.id == null ? null : Number(phase.id),
        name: normalizeCatalogString(phase.name),
        slug: normalizeCatalogString(phase.slug),
        seasonYear:
          phase.season_year == null ? null : Number(phase.season_year),
        current: Boolean(phase.current),
        hasGroups: Boolean(phase.has_groups),
        espnId: normalizeCatalogString(phase.espn_id),
        espnType: phase.espn_type == null ? null : Number(phase.espn_type),
        startDate: normalizeCatalogDate(phase.start_date),
        endDate: normalizeCatalogDate(phase.end_date)
      };
    })
    .filter(Boolean)
    .sort(
      (left, right) =>
        compareNullableNumbers(left.seasonYear, right.seasonYear) ||
        compareNullableStrings(left.startDate, right.startDate) ||
        compareNullableNumbers(left.espnId, right.espnId) ||
        compareNullableNumbers(left.id, right.id)
    );
}

function normalizeCompetitionGroups(groups) {
  return (Array.isArray(groups) ? groups : [])
    .map((group) => {
      if (!group || (!group.id && !group.name && !group.uid)) {
        return null;
      }

      return {
        id: group.id == null ? null : Number(group.id),
        phaseId: group.phase_id == null ? null : Number(group.phase_id),
        phaseEspnId: normalizeCatalogString(group.phase_espn_id),
        phaseSlug: normalizeCatalogString(group.phase_slug),
        phaseName: normalizeCatalogString(group.phase_name),
        espnId: normalizeCatalogString(group.espn_id),
        uid: normalizeCatalogString(group.uid),
        name: normalizeCatalogString(group.name),
        abbreviation: normalizeCatalogString(group.abbreviation),
        seasonYear: group.season_year == null ? null : Number(group.season_year)
      };
    })
    .filter(Boolean)
    .sort(
      (left, right) =>
        compareNullableNumbers(left.seasonYear, right.seasonYear) ||
        compareNullableNumbers(left.phaseId, right.phaseId) ||
        compareNullableNumbers(left.espnId, right.espnId) ||
        compareNullableNumbers(left.id, right.id)
    );
}

function getLatestSeasonYear(phases, groups) {
  const years = [
    ...(Array.isArray(phases) ? phases : []),
    ...(Array.isArray(groups) ? groups : [])
  ]
    .map((entry) => Number(entry && entry.seasonYear))
    .filter(Number.isFinite);

  return years.length ? Math.max(...years) : null;
}

function getGroupTabId(group) {
  const match = String(
    (group && (group.abbreviation || group.name)) || ""
  ).match(/^Group\s+([A-Z0-9]+)$/i);

  return match
    ? match[1].toUpperCase()
    : group.slug || group.uid || String(group.id);
}

function buildCompetitionNavigation(catalogEntry) {
  if (!catalogEntry || typeof catalogEntry !== "object") {
    return null;
  }

  const phases = Array.isArray(catalogEntry.phases) ? catalogEntry.phases : [];
  const groups = Array.isArray(catalogEntry.groups) ? catalogEntry.groups : [];
  const latestSeasonYear = getLatestSeasonYear(phases, groups);
  const seasonPhases =
    latestSeasonYear == null
      ? phases
      : phases.filter((phase) => phase.seasonYear === latestSeasonYear);
  const seasonGroups =
    latestSeasonYear == null
      ? groups
      : groups.filter((group) => group.seasonYear === latestSeasonYear);
  const subTabs = [];

  seasonPhases.forEach((phase) => {
    if (!phase || !phase.slug) {
      return;
    }

    const phaseGroups = seasonGroups
      .filter(
        (group) =>
          (group.phaseId != null && group.phaseId === phase.id) ||
          (group.phaseSlug && group.phaseSlug === phase.slug) ||
          (group.phaseEspnId && group.phaseEspnId === phase.espnId)
      )
      .sort(
        (left, right) =>
          compareNullableNumbers(left.espnId, right.espnId) ||
          compareNullableNumbers(left.id, right.id)
      );

    if (phase.hasGroups && phaseGroups.length > 0) {
      phaseGroups.forEach((group) => {
        subTabs.push({
          id: getGroupTabId(group),
          label: `${group.name || group.abbreviation || getGroupTabId(group)}`
            .replaceAll(/^Group\s*/gi, "")
            .trim(),
          type: "group",
          phaseId: phase.id,
          phaseSlug: phase.slug,
          phaseLabel: phase.name,
          groupId: group.id,
          groupEspnId: group.espnId,
          groupName: `${group.name}`.replaceAll(/^Group\s*/gi, "").trim(),
          seasonYear: group.seasonYear
        });
      });
      return;
    }

    subTabs.push({
      id: phase.slug,
      label: phase.name || phase.slug,
      type: "phase",
      phaseId: phase.id,
      phaseSlug: phase.slug,
      phaseLabel: phase.name,
      seasonYear: phase.seasonYear,
      startDate: phase.startDate || null,
      endDate: phase.endDate || null
    });
  });

  if (!subTabs.length) {
    return null;
  }

  return {
    source: "catalog",
    seasonYear: latestSeasonYear,
    subTabs
  };
}

function buildCompetitionCatalogIndex(leaguesResults) {
  const index = {};
  (Array.isArray(leaguesResults) ? leaguesResults : []).forEach((entry) => {
    if (!entry || typeof entry.slug !== "string" || !entry.slug.trim()) {
      return;
    }

    const slug = entry.slug.trim().toLowerCase();
    index[slug] = {
      slug,
      name:
        typeof entry.name === "string" && entry.name.trim()
          ? entry.name.trim()
          : slug,
      abbreviation:
        typeof entry.abbreviation === "string" && entry.abbreviation.trim()
          ? entry.abbreviation.trim()
          : null,
      logos: normalizeCompetitionLogos(entry.primary_logo, entry.logos),
      hasLegs: Boolean(entry.has_legs),
      phases: normalizeCompetitionPhases(entry.phases),
      groups: normalizeCompetitionGroups(entry.groups)
    };
  });

  return index;
}

function getCompetitionCatalogEntry(catalogIndex, slug) {
  if (
    !catalogIndex ||
    typeof catalogIndex !== "object" ||
    typeof slug !== "string" ||
    !slug.trim()
  ) {
    return null;
  }

  return catalogIndex[slug.trim().toLowerCase()] || null;
}

module.exports = {
  buildCompetitionNavigation,
  buildCompetitionCatalogIndex,
  getCompetitionCatalogEntry
};
