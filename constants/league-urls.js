/**
 * MMM-SoccerStandings
 * League URL maps — one entry per provider, keyed by league code.
 *
 * MAINTENANCE NOTES:
 *   Wikipedia  — season-specific; update each July/August.
 *                Aug-May leagues: "2025%E2%80%9326" (en-dash encoded).
 *                Calendar-year leagues (Norway, Sweden): plain year e.g. "2026".
 *   Soccerway  — season IDs (r#####) change every season; update r##### values.
 *                Uses heavy JS rendering; plain HTTP GET results may vary.
 *   BBC        — URLs are stable (no season IDs). UEFA entries are objects
 *                with { table, fixtures } because both endpoints are needed.
 *   ESPN       — year-independent pattern: /soccer/standings/_/league/<code>.
 *   Google     — search query strings; update season year in queries as needed.
 *
 * Dual-environment: browser global + Node.js require().
 */

const LEAGUE_URL_MAPS = {
	wikipedia: {
		ROMANIA_LIGA_I: "https://en.wikipedia.org/wiki/2025%E2%80%9326_Liga_I",
		BOLIVIA_LIGA_2:
			"https://en.wikipedia.org/wiki/2025_Copa_Sim%C3%B3n_Bol%C3%ADvar_(Bolivia)",
		SCOTLAND_PREMIERSHIP:
			"https://en.wikipedia.org/wiki/2025%E2%80%9326_Scottish_Premiership",
		SCOTLAND_CHAMPIONSHIP:
			"https://en.wikipedia.org/wiki/2025%E2%80%9326_Scottish_Championship",
		ENGLAND_PREMIER_LEAGUE:
			"https://en.wikipedia.org/wiki/2025%E2%80%9326_Premier_League",
		ENGLAND_CHAMPIONSHIP:
			"https://en.wikipedia.org/wiki/2025%E2%80%9326_EFL_Championship",
		GERMANY_BUNDESLIGA:
			"https://en.wikipedia.org/wiki/2025%E2%80%9326_Bundesliga",
		FRANCE_LIGUE1: "https://en.wikipedia.org/wiki/2025%E2%80%9326_Ligue_1",
		SPAIN_LA_LIGA: "https://en.wikipedia.org/wiki/2025%E2%80%9326_La_Liga",
		ITALY_SERIE_A: "https://en.wikipedia.org/wiki/2025%E2%80%9326_Serie_A",
		NETHERLANDS_EREDIVISIE:
			"https://en.wikipedia.org/wiki/2025%E2%80%9326_Eredivisie",
		BELGIUM_PRO_LEAGUE:
			"https://en.wikipedia.org/wiki/2025%E2%80%9326_Belgian_Pro_League",
		PORTUGAL_PRIMEIRA_LIGA:
			"https://en.wikipedia.org/wiki/2025%E2%80%9326_Primeira_Liga",
		TURKEY_SUPER_LIG:
			"https://en.wikipedia.org/wiki/2025%E2%80%9326_S%C3%BCper_Lig",
		GREECE_SUPER_LEAGUE:
			"https://en.wikipedia.org/wiki/2025%E2%80%9326_Super_League_Greece",
		AUSTRIA_BUNDESLIGA:
			"https://en.wikipedia.org/wiki/2025%E2%80%9326_Austrian_Football_Bundesliga",
		DENMARK_SUPERLIGAEN:
			"https://en.wikipedia.org/wiki/2025%E2%80%9326_Danish_Superliga",
		NORWAY_ELITESERIEN: "https://en.wikipedia.org/wiki/2026_Eliteserien",
		SWEDEN_ALLSVENSKAN: "https://en.wikipedia.org/wiki/2026_Allsvenskan",
		SWITZERLAND_SUPER_LEAGUE:
			"https://en.wikipedia.org/wiki/2025%E2%80%9326_Swiss_Super_League",
		UKRAINE_PREMIER_LEAGUE:
			"https://en.wikipedia.org/wiki/2025%E2%80%9326_Ukrainian_Premier_League",
		CROATIA_HNL:
			"https://en.wikipedia.org/wiki/2025%E2%80%9326_Croatian_Football_League",
		SERBIA_SUPER_LIGA:
			"https://en.wikipedia.org/wiki/2025%E2%80%9326_Serbian_SuperLiga",
		HUNGARY_NBI:
			"https://en.wikipedia.org/wiki/2025%E2%80%9326_Nemzeti_Bajnoks%C3%A1g_I",
		POLAND_EKSTRAKLASA:
			"https://en.wikipedia.org/wiki/2025%E2%80%9326_Ekstraklasa",
		CZECH_LIGA:
			"https://en.wikipedia.org/wiki/2025%E2%80%9326_Czech_First_League",
		CYMRU_PREMIER_LEAGUE:
			"https://en.wikipedia.org/wiki/2025%E2%80%9326_Cymru_Premier",
		CYPRUS_FIRST_DIVISION:
			"https://en.wikipedia.org/wiki/2025%E2%80%9326_Cypriot_First_Division",
		ISRAEL_PREMIER_LEAGUE:
			"https://en.wikipedia.org/wiki/2025%E2%80%9326_Israeli_Premier_League"
	},

	soccerway: {
		AUSTRIA_BUNDESLIGA:
			"https://int.soccerway.com/national/austria/bundesliga/20252026/regular-season/r87207/",
		BOLIVIA_LIGA_2:
			"https://int.soccerway.com/national/bolivia/nacional-b/2025/regular-season/r86100/",
		SCOTLAND_PREMIERSHIP:
			"https://int.soccerway.com/national/scotland/premier-league/20252026/regular-season/r87208/",
		ENGLAND_PREMIER_LEAGUE:
			"https://int.soccerway.com/national/england/premier-league/20252026/regular-season/r87209/",
		GERMANY_BUNDESLIGA:
			"https://int.soccerway.com/national/germany/bundesliga/20252026/regular-season/r87210/",
		FRANCE_LIGUE1:
			"https://int.soccerway.com/national/france/ligue-1/20252026/regular-season/r87211/",
		SPAIN_LA_LIGA:
			"https://int.soccerway.com/national/spain/primera-division/20252026/regular-season/r87212/",
		ITALY_SERIE_A:
			"https://int.soccerway.com/national/italy/serie-a/20252026/regular-season/r87213/",
		CYMRU_PREMIER_LEAGUE:
			"https://int.soccerway.com/national/wales/cymru-premier/20252026/regular-season/r87300/"
	},

	google: {
		ROMANIA_LIGA_I:
			"https://www.google.com/search?q=Romanian+Superliga+table+standings+2025-26",
		BOLIVIA_LIGA_2:
			"https://www.google.com/search?q=Bolivia+Copa+Simon+Bolivar+table+2025",
		SCOTLAND_PREMIERSHIP:
			"https://www.google.com/search?q=Scottish+Premiership+table+standings",
		ENGLAND_PREMIER_LEAGUE:
			"https://www.google.com/search?q=Premier+League+table+standings",
		GERMANY_BUNDESLIGA:
			"https://www.google.com/search?q=Bundesliga+table+standings",
		FRANCE_LIGUE1: "https://www.google.com/search?q=Ligue+1+table+standings",
		SPAIN_LA_LIGA: "https://www.google.com/search?q=La+Liga+table+standings",
		ITALY_SERIE_A: "https://www.google.com/search?q=Serie+A+table+standings",
		AUSTRIA_BUNDESLIGA:
			"https://www.google.com/search?q=Austrian+Bundesliga+table+standings",
		BELGIUM_PRO_LEAGUE:
			"https://www.google.com/search?q=Belgian+Pro+League+table+standings",
		CYMRU_PREMIER_LEAGUE:
			"https://www.google.com/search?q=Cymru+Premier+League+table+standings"
	},

	espn: {
		SCOTLAND_PREMIERSHIP:
			"https://www.espn.com/soccer/standings/_/league/sco.1",
		SCOTLAND_CHAMPIONSHIP:
			"https://www.espn.com/soccer/standings/_/league/sco.2",
		ENGLAND_PREMIER_LEAGUE:
			"https://www.espn.com/soccer/standings/_/league/eng.1",
		ENGLAND_CHAMPIONSHIP:
			"https://www.espn.com/soccer/standings/_/league/eng.2",
		GERMANY_BUNDESLIGA:
			"https://www.espn.com/soccer/standings/_/league/ger.1",
		FRANCE_LIGUE1: "https://www.espn.com/soccer/standings/_/league/fra.1",
		SPAIN_LA_LIGA: "https://www.espn.com/soccer/standings/_/league/esp.1",
		ITALY_SERIE_A: "https://www.espn.com/soccer/standings/_/league/ita.1",
		NETHERLANDS_EREDIVISIE:
			"https://www.espn.com/soccer/standings/_/league/ned.1",
		BELGIUM_PRO_LEAGUE:
			"https://www.espn.com/soccer/standings/_/league/bel.1",
		PORTUGAL_PRIMEIRA_LIGA:
			"https://www.espn.com/soccer/standings/_/league/por.1",
		TURKEY_SUPER_LIG: "https://www.espn.com/soccer/standings/_/league/tur.1",
		GREECE_SUPER_LEAGUE:
			"https://www.espn.com/soccer/standings/_/league/gre.1",
		AUSTRIA_BUNDESLIGA:
			"https://www.espn.com/soccer/standings/_/league/aut.1",
		DENMARK_SUPERLIGAEN:
			"https://www.espn.com/soccer/standings/_/league/den.1",
		NORWAY_ELITESERIEN:
			"https://www.espn.com/soccer/standings/_/league/nor.1",
		SWEDEN_ALLSVENSKAN:
			"https://www.espn.com/soccer/standings/_/league/swe.1",
		SWITZERLAND_SUPER_LEAGUE:
			"https://www.espn.com/soccer/standings/_/league/sui.1",
		ROMANIA_LIGA_I: "https://www.espn.com/soccer/standings/_/league/rou.1",
		CROATIA_HNL: "https://www.espn.com/soccer/standings/_/league/cro.1",
		SERBIA_SUPER_LIGA: "https://www.espn.com/soccer/standings/_/league/srb.1",
		UKRAINE_PREMIER_LEAGUE:
			"https://www.espn.com/soccer/standings/_/league/ukr.1",
		HUNGARY_NBI: "https://www.espn.com/soccer/standings/_/league/hun.1",
		POLAND_EKSTRAKLASA:
			"https://www.espn.com/soccer/standings/_/league/pol.1",
		CZECH_LIGA: "https://www.espn.com/soccer/standings/_/league/cze.1",
		CYMRU_PREMIER_LEAGUE:
			"https://www.espn.com/soccer/standings/_/league/wal.1",
		CYPRUS_FIRST_DIVISION:
			"https://www.espn.com/soccer/standings/_/league/cyp.1",
		ISRAEL_PREMIER_LEAGUE:
			"https://www.espn.com/soccer/standings/_/league/isr.1"
	},

	bbc: {
		// Domestic leagues
		SCOTLAND_PREMIERSHIP:
			"https://www.bbc.co.uk/sport/football/scottish-premiership/table",
		SCOTLAND_CHAMPIONSHIP:
			"https://www.bbc.co.uk/sport/football/scottish-championship/table",
		ENGLAND_PREMIER_LEAGUE:
			"https://www.bbc.co.uk/sport/football/premier-league/table",
		ENGLAND_CHAMPIONSHIP:
			"https://www.bbc.co.uk/sport/football/english-championship/table",
		GERMANY_BUNDESLIGA:
			"https://www.bbc.co.uk/sport/football/german-bundesliga/table",
		FRANCE_LIGUE1:
			"https://www.bbc.co.uk/sport/football/french-ligue-one/table",
		SPAIN_LA_LIGA:
			"https://www.bbc.co.uk/sport/football/spanish-la-liga/table",
		ITALY_SERIE_A:
			"https://www.bbc.co.uk/sport/football/italian-serie-a/table",
		NETHERLANDS_EREDIVISIE:
			"https://www.bbc.co.uk/sport/football/dutch-eredivisie/table",
		BELGIUM_PRO_LEAGUE:
			"https://www.bbc.co.uk/sport/football/belgian-pro-league/table",
		PORTUGAL_PRIMEIRA_LIGA:
			"https://www.bbc.co.uk/sport/football/portuguese-primeira-liga/table",
		TURKEY_SUPER_LIG:
			"https://www.bbc.co.uk/sport/football/turkish-super-lig/table",
		GREECE_SUPER_LEAGUE:
			"https://www.bbc.co.uk/sport/football/greek-super-league/table",
		AUSTRIA_BUNDESLIGA:
			"https://www.bbc.co.uk/sport/football/austrian-bundesliga/table",
		CZECH_LIGA: "https://www.bbc.co.uk/sport/football/czech-liga/table",
		DENMARK_SUPERLIGAEN:
			"https://www.bbc.co.uk/sport/football/danish-superliga/table",
		NORWAY_ELITESERIEN:
			"https://www.bbc.co.uk/sport/football/norwegian-eliteserien/table",
		SWEDEN_ALLSVENSKAN:
			"https://www.bbc.co.uk/sport/football/swedish-allsvenskan/table",
		SWITZERLAND_SUPER_LEAGUE:
			"https://www.bbc.co.uk/sport/football/swiss-super-league/table",
		UKRAINE_PREMIER_LEAGUE:
			"https://www.bbc.co.uk/sport/football/ukrainian-premier-league/table",
		ROMANIA_LIGA_I:
			"https://www.bbc.co.uk/sport/football/romanian-liga-i/table",
		CROATIA_HNL:
			"https://www.bbc.co.uk/sport/football/croatian-first-league/table",
		SERBIA_SUPER_LIGA:
			"https://www.bbc.co.uk/sport/football/serbian-super-lig/table",
		HUNGARY_NBI: "https://www.bbc.co.uk/sport/football/hungarian-nb-i/table",
		POLAND_EKSTRAKLASA:
			"https://www.bbc.co.uk/sport/football/polish-ekstraklasa/table",
		CYMRU_PREMIER_LEAGUE:
			"https://www.bbc.co.uk/sport/football/cymru-premier/table",
		CYPRUS_FIRST_DIVISION:
			"https://www.bbc.co.uk/sport/football/cypriot-first-division/table",
		ISRAEL_PREMIER_LEAGUE:
			"https://www.bbc.co.uk/sport/football/israeli-premier-league/table",

		// UEFA Competitions — object with { table, fixtures } because both endpoints are needed
		UEFA_CHAMPIONS_LEAGUE: {
			table: "https://www.bbc.co.uk/sport/football/champions-league/table",
			fixtures:
				"https://www.bbc.co.uk/sport/football/champions-league/scores-fixtures"
		},
		UEFA_EUROPA_LEAGUE: {
			table: "https://www.bbc.co.uk/sport/football/europa-league/table",
			fixtures:
				"https://www.bbc.co.uk/sport/football/europa-league/scores-fixtures"
		},
		UEFA_EUROPA_CONFERENCE_LEAGUE: {
			table:
				"https://www.bbc.co.uk/sport/football/europa-conference-league/table",
			fixtures:
				"https://www.bbc.co.uk/sport/football/europa-conference-league/scores-fixtures"
		},

		// World Cup
		WORLD_CUP_2026: [
			"https://www.bbc.co.uk/sport/football/world-cup/scores-fixtures/2026-06",
			"https://www.bbc.co.uk/sport/football/world-cup/scores-fixtures/2026-07"
		],

		// Short-code aliases (normalizeLeagueCode maps these, but kept for direct lookup safety)
		UCL: {
			table: "https://www.bbc.co.uk/sport/football/champions-league/table",
			fixtures:
				"https://www.bbc.co.uk/sport/football/champions-league/scores-fixtures"
		},
		UEL: {
			table: "https://www.bbc.co.uk/sport/football/europa-league/table",
			fixtures:
				"https://www.bbc.co.uk/sport/football/europa-league/scores-fixtures"
		},
		ECL: {
			table:
				"https://www.bbc.co.uk/sport/football/europa-conference-league/table",
			fixtures:
				"https://www.bbc.co.uk/sport/football/europa-conference-league/scores-fixtures"
		}
	}
};

if (typeof module !== "undefined" && module.exports) {
	module.exports = { LEAGUE_URL_MAPS };
}
