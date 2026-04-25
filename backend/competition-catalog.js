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
			hasLegs: Boolean(entry.has_legs)
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
	buildCompetitionCatalogIndex,
	getCompetitionCatalogEntry
};
