/**
 * MMM-SoccerStandings
 * Shared team name alias map — single source of truth for both frontend and backend.
 * Loaded as a global in the browser (via getScripts), required in Node.js (logo-resolver.js).
 */

const TEAM_ALIASES = {
	"cabo verde": "Cape Verde",
	"cape verde islands": "Cape Verde",
	"ir iran": "Iran",
	"iran, islamic republic of": "Iran",
	"south korea": "Rep. of Korea",
	"korea republic": "Rep. of Korea",
	"korea, republic of": "Rep. of Korea",
	"côte d'ivoire": "Ivory Coast",
	"cote d'ivoire": "Ivory Coast",
	"bosnia-herzegovina": "Bosnia and Herzegovina",
	"bosnia & herzegovina": "Bosnia and Herzegovina",
	curacao: "Curaçao",
	usa: "United States",
	"united states (host)": "United States",
	"mexico (host)": "Mexico",
	"canada (host)": "Canada",
	"argentina (title holder)": "Argentina",
	"united states of america": "United States",
	czechia: "Czech Republic",
	"check republic": "Czech Republic",
	"congo dr": "DR Congo",
	"democratic republic of congo": "DR Congo",
	"rd congo": "DR Congo",
	"democratic republic of the congo": "DR Congo",
	türkiye: "Turkey",
	"north macedonia": "Macedonia",
	"viet nam": "Vietnam",
	eswatini: "Swaziland"
};

// Works in both browser (global) and Node.js (require)
if (typeof module !== "undefined") module.exports = TEAM_ALIASES;
