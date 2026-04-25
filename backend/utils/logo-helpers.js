"use strict";

function getRelLogoHref(logos, relValue) {
	return (Array.isArray(logos) ? logos : [])
		.map((logoEntry) => {
			if (!logoEntry || typeof logoEntry.href !== "string" || !logoEntry.href.trim()) {
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
		.find((logoEntry) => logoEntry.rel.includes(relValue))?.href;
}

function pickPreferredLogo(primaryLogo, logos, fallbackLogo = null) {
	const explicitPrimary =
		typeof primaryLogo === "string" && primaryLogo.trim() ? primaryLogo.trim() : null;
	const darkLogo = getRelLogoHref(logos, "dark") || null;
	const defaultLogo = getRelLogoHref(logos, "default") || null;
	const fallback =
		typeof fallbackLogo === "string" && fallbackLogo.trim() ? fallbackLogo.trim() : null;

	return explicitPrimary || darkLogo || defaultLogo || fallback || null;
}

module.exports = { getRelLogoHref, pickPreferredLogo };
