const canonicalProviders = {};

function registerCanonicalProvider(providerId, factory) {
  if (typeof providerId !== "string" || !providerId.trim()) {
    throw new Error("Canonical provider id is required");
  }
  if (typeof factory !== "function") {
    throw new Error(
      `Canonical provider factory for "${providerId}" must be a function`
    );
  }

  canonicalProviders[providerId.trim().toLowerCase()] = factory;
}

function initializeCanonicalProvider(providerId, options = {}) {
  const normalizedProviderId =
    typeof providerId === "string" && providerId.trim()
      ? providerId.trim().toLowerCase()
      : null;
  if (!normalizedProviderId || !canonicalProviders[normalizedProviderId]) {
    throw new Error(`Unsupported canonical provider: ${providerId}`);
  }

  return canonicalProviders[normalizedProviderId](options);
}

module.exports = {
  registerCanonicalProvider,
  initializeCanonicalProvider
};
