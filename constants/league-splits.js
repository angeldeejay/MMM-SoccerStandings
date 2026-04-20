/**
 * MMM-SoccerStandings
 * League split configurations for mid-season table splits.
 *
 * Each entry describes a league that divides into Championship and Relegation
 * groups mid-season. Parsers use this to select the correct post-split group
 * table rather than the pre-split full table.
 *
 * Fields:
 *   regularSeasonGames   — games played per team before the split occurs
 *   championshipSize     — teams in the top (championship) group
 *   relegationSize       — teams in the bottom (relegation) group
 *   pointsCarryover      — "all" | "halved" | "mixed"
 *   showAllGroups        — true = render all groups simultaneously
 *   groups[]             — ordered list of groups with label + heading keywords
 *   championshipKeywords — Wikipedia heading fragments for the top group
 *   relegationKeywords   — Wikipedia heading fragments for the bottom group
 *   preferGroup          — "championship" | "relegation" (default display)
 *
 * Dual-environment: browser global + Node.js require().
 * Sources: leagueSplits_Guide.md
 */

const LEAGUE_SPLITS = {
	ROMANIA_LIGA_I: {
		regularSeasonGames: 30,
		championshipSize: 6,
		relegationSize: 10,
		pointsCarryover: "halved",
		showAllGroups: true,
		groups: [
			{
				label: "Play-off Group",
				size: 6,
				keywords: [
					"play-off table",
					"play-off round",
					"playoff table",
					"playoff round",
					"championship round",
					"championship group",
					"championship table"
				]
			},
			{
				label: "Play-out Group",
				size: 10,
				keywords: [
					"play-out table",
					"play-out round",
					"relegation round",
					"relegation group",
					"relegation table"
				]
			}
		],
		championshipKeywords: [
			"championship round",
			"championship group",
			"playoff round",
			"play-off round",
			"play-off table",
			"playoff table"
		],
		relegationKeywords: [
			"relegation round",
			"relegation group",
			"play-out round",
			"play-out table"
		],
		preferGroup: "championship"
	},
	SCOTLAND_PREMIERSHIP: {
		regularSeasonGames: 33,
		championshipSize: 6,
		relegationSize: 6,
		pointsCarryover: "all",
		showAllGroups: true,
		groups: [
			{
				label: "Top Six",
				size: 6,
				keywords: [
					"top six",
					"top 6",
					"championship group",
					"championship round",
					"championship table",
					"upper tier"
				]
			},
			{
				label: "Bottom Six",
				size: 6,
				keywords: [
					"bottom six",
					"bottom 6",
					"relegation group",
					"relegation round",
					"relegation table",
					"lower tier"
				]
			}
		],
		championshipKeywords: [
			"championship group",
			"top six",
			"top 6",
			"upper tier",
			"championship table"
		],
		relegationKeywords: [
			"relegation group",
			"bottom six",
			"bottom 6",
			"lower tier",
			"relegation table"
		],
		preferGroup: "championship"
	},
	AUSTRIA_BUNDESLIGA: {
		regularSeasonGames: 22,
		championshipSize: 6,
		relegationSize: 6,
		pointsCarryover: "halved",
		showAllGroups: true,
		groups: [
			{
				label: "Championship Round",
				size: 6,
				keywords: [
					"championship round",
					"meistergruppe",
					"meister-gruppe",
					"championship group",
					"top group",
					"championship table"
				]
			},
			{
				label: "Relegation Round",
				size: 6,
				keywords: [
					"relegation round",
					"qualifikationsgruppe",
					"relegation group",
					"bottom group",
					"relegation table"
				]
			}
		],
		championshipKeywords: [
			"championship round",
			"championship group",
			"meister-gruppe",
			"meistergruppe",
			"top group",
			"meistergruppe table"
		],
		relegationKeywords: [
			"relegation round",
			"relegation group",
			"qualifikationsgruppe",
			"bottom group",
			"qualifikationsgruppe table"
		],
		preferGroup: "championship"
	},
	BELGIUM_PRO_LEAGUE: {
		regularSeasonGames: 30,
		championshipSize: 6,
		relegationSize: 10,
		pointsCarryover: "halved",
		showAllGroups: true,
		groups: [
			{
				label: "Champions' Play-offs",
				size: 6,
				keywords: [
					"champions' play-offs",
					"champions play-offs",
					"championship play-offs",
					"championship playoff",
					"championship group",
					"championship round",
					"top 6",
					"po1",
					"play-offs i",
					"playoffs i"
				]
			},
			{
				label: "Europa Play-offs",
				size: 6,
				keywords: [
					"europa play-offs",
					"europe play-offs",
					"europa playoffs",
					"po2",
					"play-offs ii",
					"playoffs ii",
					"europa league play-offs",
					"conference league play-offs"
				]
			},
			{
				label: "Relegation Play-offs",
				size: 4,
				keywords: [
					"relegation play-offs",
					"relegation playoff",
					"relegation group",
					"bottom 4",
					"relegation table"
				]
			}
		],
		championshipKeywords: [
			"champions' play-offs",
			"champions play-offs",
			"championship play-offs",
			"championship playoff",
			"championship round",
			"top 6",
			"championship table"
		],
		relegationKeywords: [
			"relegation play-offs",
			"relegation group",
			"bottom group",
			"relegation table"
		],
		preferGroup: "championship"
	},
	SWITZERLAND_SUPER_LEAGUE: {
		regularSeasonGames: 33,
		championshipSize: 6,
		relegationSize: 6,
		pointsCarryover: "all",
		showAllGroups: true,
		groups: [
			{
				label: "Championship Group",
				size: 6,
				keywords: [
					"meisterrunde",
					"championship group",
					"championship round",
					"top 6",
					"championship table"
				]
			},
			{
				label: "Relegation Group",
				size: 6,
				keywords: [
					"abstiegsrunde",
					"relegation group",
					"relegation round",
					"bottom 6",
					"relegation table"
				]
			}
		],
		championshipKeywords: [
			"championship group",
			"meisterrunde",
			"top 6",
			"meisterrunde table"
		],
		relegationKeywords: [
			"relegation group",
			"abstiegsrunde",
			"bottom 6",
			"abstiegsrunde table"
		],
		preferGroup: "championship"
	},
	DENMARK_SUPERLIGAEN: {
		regularSeasonGames: 22,
		championshipSize: 6,
		relegationSize: 6,
		pointsCarryover: "all",
		showAllGroups: true,
		groups: [
			{
				label: "Championship Group",
				size: 6,
				keywords: [
					"championship group",
					"championship round",
					"top 6",
					"upper half",
					"championship table"
				]
			},
			{
				label: "Relegation Group",
				size: 6,
				keywords: [
					"relegation group",
					"relegation round",
					"bottom 6",
					"lower half",
					"relegation table"
				]
			}
		],
		championshipKeywords: [
			"championship group",
			"top 6",
			"upper half",
			"championship table"
		],
		relegationKeywords: [
			"relegation group",
			"bottom 6",
			"lower half",
			"relegation table"
		],
		preferGroup: "championship"
	},
	SERBIA_SUPER_LIGA: {
		regularSeasonGames: 30,
		championshipSize: 8,
		relegationSize: 8,
		pointsCarryover: "all",
		showAllGroups: true,
		groups: [
			{
				label: "Championship Group",
				size: 8,
				keywords: [
					"championship group",
					"championship round",
					"top 8",
					"first group",
					"championship table"
				]
			},
			{
				label: "Relegation Group",
				size: 8,
				keywords: [
					"relegation group",
					"relegation round",
					"bottom 8",
					"second group",
					"relegation table"
				]
			}
		],
		championshipKeywords: [
			"championship group",
			"top 8",
			"first group",
			"championship table"
		],
		relegationKeywords: [
			"relegation group",
			"bottom 8",
			"second group",
			"relegation table"
		],
		preferGroup: "championship"
	},
	CYMRU_PREMIER_LEAGUE: {
		regularSeasonGames: 22,
		championshipSize: 6,
		relegationSize: 6,
		pointsCarryover: "all",
		showAllGroups: true,
		groups: [
			{
				label: "Championship Group",
				size: 6,
				keywords: [
					"championship group",
					"championship round",
					"top 6",
					"upper half",
					"championship table"
				]
			},
			{
				label: "Relegation Group",
				size: 6,
				keywords: [
					"relegation group",
					"relegation round",
					"bottom 6",
					"lower half",
					"relegation table"
				]
			}
		],
		championshipKeywords: [
			"championship group",
			"top 6",
			"upper half",
			"championship table"
		],
		relegationKeywords: [
			"relegation group",
			"bottom 6",
			"lower half",
			"relegation table"
		],
		preferGroup: "championship"
	},
	// Greece Super League: 14 teams, 26-game double RR regular season (Phase 1), then THREE groups:
	//   Championship play-offs (top 4): 6 more games (double RR), points carry over fully.
	//   Europe play-offs (5th-8th, 4 teams): 6 more games (double RR), points HALVED (rounded up).
	//   Relegation play-outs (9th-14th, 6 teams): 10 more games (double RR), points carry over fully.
	// pointsCarryover="mixed": Championship/Relegation keep all points; Europe group halves them.
	GREECE_SUPER_LEAGUE: {
		regularSeasonGames: 26,
		championshipSize: 4,
		relegationSize: 6,
		pointsCarryover: "mixed",
		showAllGroups: true,
		groups: [
			{
				label: "Championship Play-offs",
				size: 4,
				keywords: [
					"championship play-offs",
					"championship play-off",
					"championship playoff",
					"championship round",
					"championship group",
					"championship table"
				]
			},
			{
				label: "Europe Play-offs",
				size: 4,
				keywords: [
					"europe play-offs",
					"europe play-off",
					"europa play-offs",
					"conference league play-offs",
					"european play-offs",
					"europe playoff"
				]
			},
			{
				label: "Relegation Play-outs",
				size: 6,
				keywords: [
					"relegation play-outs",
					"relegation play-out",
					"relegation playoff",
					"relegation round",
					"relegation group",
					"relegation table"
				]
			}
		],
		championshipKeywords: [
			"championship play-offs",
			"championship play-off",
			"championship playoff",
			"championship table"
		],
		relegationKeywords: [
			"relegation play-outs",
			"relegation play-out",
			"relegation playoff",
			"relegation table"
		],
		preferGroup: "championship"
	},
	// Cyprus First Division: 14 teams, 26-game double RR regular season (Phase 1), then TWO groups:
	//   Championship round (top 6): 10 more games (double RR within 6 teams), all points carry over.
	//   Relegation round (7th-14th, 8 teams): 7 more games (single RR), all points carry over.
	// Bottom three teams in the relegation round are relegated.
	CYPRUS_FIRST_DIVISION: {
		regularSeasonGames: 26,
		championshipSize: 6,
		relegationSize: 8,
		pointsCarryover: "all",
		showAllGroups: true,
		groups: [
			{
				label: "Championship Round",
				size: 6,
				keywords: [
					"championship round",
					"championship playoff",
					"championship group",
					"top 6",
					"championship table"
				]
			},
			{
				label: "Relegation Round",
				size: 8,
				keywords: [
					"relegation round",
					"relegation playoff",
					"relegation group",
					"bottom 8",
					"relegation table"
				]
			}
		],
		championshipKeywords: [
			"championship round",
			"championship playoff",
			"championship group",
			"top 6",
			"championship table"
		],
		relegationKeywords: [
			"relegation round",
			"relegation playoff",
			"relegation group",
			"bottom 8",
			"relegation table"
		],
		preferGroup: "championship"
	},
	// Israel Premier League: 14 teams, 26-game double RR regular season (Phase 1), then TWO groups:
	//   Championship round (top 6): 10 more games (double RR within 6 teams), all points carry over.
	//   Relegation round (7th-14th, 8 teams): 7 more games (single RR), all points carry over.
	ISRAEL_PREMIER_LEAGUE: {
		regularSeasonGames: 26,
		championshipSize: 6,
		relegationSize: 8,
		pointsCarryover: "all",
		showAllGroups: true,
		groups: [
			{
				label: "Championship Round",
				size: 6,
				keywords: [
					"championship round",
					"championship playoff",
					"championship group",
					"top 6",
					"championship table"
				]
			},
			{
				label: "Relegation Round",
				size: 8,
				keywords: [
					"relegation round",
					"relegation playoff",
					"relegation group",
					"bottom 8",
					"relegation table"
				]
			}
		],
		championshipKeywords: [
			"championship round",
			"championship playoff",
			"championship group",
			"top 6",
			"championship table"
		],
		relegationKeywords: [
			"relegation round",
			"relegation playoff",
			"relegation group",
			"bottom 8",
			"relegation table"
		],
		preferGroup: "championship"
	}
};

if (typeof module !== "undefined" && module.exports) {
	module.exports = { LEAGUE_SPLITS };
}
