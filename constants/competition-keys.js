const COMPETITION_KEYS = Object.freeze({
  FIFA_WORLD: "FIFA_WORLD",
  UEFA_CHAMPIONS: "UEFA_CHAMPIONS",
  UEFA_EUROPA: "UEFA_EUROPA",
  UEFA_EUROPA_CONFERENCE: "UEFA_EUROPA_CONFERENCE",
  COLOMBIA_PRIMERA: "COLOMBIA_PRIMERA"
});

const DEFAULT_COMPETITION_PROVIDER = "espn_service";

const COMPETITION_SELECTION_ALIASES = Object.freeze({
  WORLD_CUP_2026: COMPETITION_KEYS.FIFA_WORLD,
  FIFA_WORLD_CUP_2026: COMPETITION_KEYS.FIFA_WORLD,
  UEFA_CHAMPIONS_LEAGUE: COMPETITION_KEYS.UEFA_CHAMPIONS,
  UEFA_EUROPA_LEAGUE: COMPETITION_KEYS.UEFA_EUROPA,
  UEFA_EUROPA_CONFERENCE_LEAGUE: COMPETITION_KEYS.UEFA_EUROPA_CONFERENCE
});

const COMPETITION_PROVIDER_KEYS = Object.freeze({
  espn_service: Object.freeze({
    [COMPETITION_KEYS.FIFA_WORLD]: "fifa.world",
    [COMPETITION_KEYS.UEFA_CHAMPIONS]: "uefa.champions",
    [COMPETITION_KEYS.UEFA_EUROPA]: "uefa.europa",
    [COMPETITION_KEYS.UEFA_EUROPA_CONFERENCE]: "uefa.europa.conf",
    [COMPETITION_KEYS.COLOMBIA_PRIMERA]: "col.1"
  })
});

function normalizeCompetitionProviderId(
  providerId = DEFAULT_COMPETITION_PROVIDER
) {
  if (typeof providerId !== "string" || !providerId.trim()) {
    return DEFAULT_COMPETITION_PROVIDER;
  }

  return providerId.trim().toLowerCase();
}

function getCompetitionProviderKeys(providerId = DEFAULT_COMPETITION_PROVIDER) {
  const normalizedProviderId = normalizeCompetitionProviderId(providerId);
  return COMPETITION_PROVIDER_KEYS[normalizedProviderId] || null;
}

function isCompetitionKey(value) {
  return (
    typeof value === "string" &&
    Object.values(COMPETITION_KEYS).includes(value.trim())
  );
}

function getCompetitionValue(
  competitionKey,
  providerId = DEFAULT_COMPETITION_PROVIDER
) {
  if (!isCompetitionKey(competitionKey)) {
    return null;
  }

  const providerKeys = getCompetitionProviderKeys(providerId);
  return providerKeys ? providerKeys[competitionKey] || null : null;
}

function getCompetitionKey(value, providerId = DEFAULT_COMPETITION_PROVIDER) {
  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim();
  if (!normalizedValue) {
    return null;
  }

  const aliasedKey = COMPETITION_SELECTION_ALIASES[normalizedValue];
  if (aliasedKey) {
    return aliasedKey;
  }

  if (isCompetitionKey(normalizedValue)) {
    return normalizedValue;
  }

  const providerKeys = getCompetitionProviderKeys(providerId);
  if (!providerKeys) {
    return null;
  }

  return (
    Object.keys(providerKeys).find(
      (competitionKey) => providerKeys[competitionKey] === normalizedValue
    ) || null
  );
}

function isProviderCompetitionValue(
  value,
  providerId = DEFAULT_COMPETITION_PROVIDER
) {
  if (typeof value !== "string") {
    return false;
  }

  const normalizedValue = value.trim();
  const providerKeys = getCompetitionProviderKeys(providerId);
  return Boolean(
    providerKeys && Object.values(providerKeys).includes(normalizedValue)
  );
}

if (typeof globalThis !== "undefined") {
  globalThis.COMPETITION_KEYS = COMPETITION_KEYS;
  globalThis.COMPETITION_PROVIDER_KEYS = COMPETITION_PROVIDER_KEYS;
  globalThis.DEFAULT_COMPETITION_PROVIDER = DEFAULT_COMPETITION_PROVIDER;
  globalThis.getCompetitionProviderKeys = getCompetitionProviderKeys;
  globalThis.getCompetitionKey = getCompetitionKey;
  globalThis.getCompetitionValue = getCompetitionValue;
  globalThis.isCompetitionKey = isCompetitionKey;
  globalThis.isProviderCompetitionValue = isProviderCompetitionValue;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    COMPETITION_KEYS,
    COMPETITION_SELECTION_ALIASES,
    COMPETITION_PROVIDER_KEYS,
    DEFAULT_COMPETITION_PROVIDER,
    getCompetitionProviderKeys,
    getCompetitionKey,
    getCompetitionValue,
    isCompetitionKey,
    isProviderCompetitionValue
  };
}
