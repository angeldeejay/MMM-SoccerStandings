(function registerCompetitionProviderRuntime(globalScope) {
  const registeredProviders = {};

  const baseProvider = {
    providerIdentifier: null,
    providerName: null,
    config: null,
    delegate: null,
    defaults: {},

    setConfig(config) {
      this.config = config;
    },

    resolveLeagueSlug() {
      return null;
    },

    getCompetitionInfo() {
      return null;
    },

    isFlatCompetition() {
      return false;
    },

    isGroupedCompetition() {
      return false;
    },

    supportsCompetition(leagueCode) {
      return (
        this.isFlatCompetition(leagueCode) ||
        this.isGroupedCompetition(leagueCode)
      );
    }
  };

  globalScope.CompetitionProvider = {
    register(providerIdentifier, providerDetails) {
      if (
        typeof providerIdentifier !== "string" ||
        !providerIdentifier.trim()
      ) {
        throw new Error("Competition provider identifier is required");
      }

      registeredProviders[providerIdentifier.trim().toLowerCase()] =
        providerDetails || {};
    },

    initialize(providerIdentifier, delegate) {
      const normalizedIdentifier =
        typeof providerIdentifier === "string" && providerIdentifier.trim()
          ? providerIdentifier.trim().toLowerCase()
          : "espn_service";
      const providerDetails = registeredProviders[normalizedIdentifier];
      if (!providerDetails) {
        throw new Error(
          `Unsupported competition provider: ${providerIdentifier}`
        );
      }

      const provider = Object.assign(
        Object.create(baseProvider),
        providerDetails
      );
      provider.delegate = delegate;
      provider.providerIdentifier = normalizedIdentifier;
      provider.providerName = provider.providerName || normalizedIdentifier;
      provider.setConfig(
        Object.assign({}, provider.defaults || {}, delegate.config || {})
      );

      return provider;
    }
  };
})(globalThis);
