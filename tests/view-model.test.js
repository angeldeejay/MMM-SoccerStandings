const assert = require("assert");

const { COMPETITION_KEYS } = require("../constants/competition-keys.js");
const {
  buildCanonicalGroupedStandingsPayload,
  buildCanonicalStandingsPayload,
  getDefaultSlug
} = require("../backend/slice1-flat-standings.js");
const { loadRegisteredModuleDefinition } = require("./helpers/setup.js");

loadRegisteredModuleDefinition();

describe("View model adapters", () => {
  it("initializes the active frontend provider through the registry", () => {
    const provider = globalThis.CompetitionProvider.initialize("espn_service", {
      config: {
        provider: "espn_service"
      }
    });

    assert.strictEqual(
      provider.resolveLeagueSlug(COMPETITION_KEYS.UEFA_CHAMPIONS),
      "uefa.champions"
    );
    assert.strictEqual(provider.isGroupedCompetition("fifa.world"), true);
    assert.deepStrictEqual(
      provider.getCompetitionInfo("col.1", {
        competition: {
          name: "Colombian Primera A",
          abbreviation: "Colombian Primera A",
          logos: {
            primary: "https://img.example/col-primary.png",
            dark: "https://img.example/col-dark.png",
            default: "https://img.example/col-default.png",
            light: null
          }
        }
      }),
      {
        name: "Colombian Primera A",
        abbreviation: "CPA",
        logo: "https://img.example/col-primary.png",
        logos: {
          primary: "https://img.example/col-primary.png",
          dark: "https://img.example/col-dark.png",
          default: "https://img.example/col-default.png",
          light: null
        }
      }
    );
  });

  it("builds flat legacy-shaped view models from canonical payloads", () => {
    const payload = buildCanonicalStandingsPayload({
      leagueType: COMPETITION_KEYS.COLOMBIA_PRIMERA,
      slug: getDefaultSlug(COMPETITION_KEYS.COLOMBIA_PRIMERA),
      leagueName: "Colombian Primera A",
      leagueAbbreviation: "Colombian Primera A",
      standingsResults: [
        {
          team_espn_id: "5264",
          team_name: "Atletico Nacional",
          team_abbreviation: "NAL",
          season_year: 2026,
          season_type: 1,
          rank: 1,
          wins: 13,
          losses: 3,
          ties: 1,
          points: 40,
          form: ["W", "W", "D"],
          stats: [
            { name: "pointsFor", value: 35 },
            { name: "pointsAgainst", value: 13 },
            { name: "pointDifferential", value: 22 }
          ]
        }
      ],
      fixturesResults: [
        {
          id: "fix-1",
          date: "2026-04-24T20:00:00Z",
          status: "STATUS_SCHEDULED",
          venue_name: "Atanasio Girardot",
          home_team: {
            espn_id: "5264",
            display_name: "Atletico Nacional",
            abbreviation: "NAL",
            primary_logo: "https://img.example/nal.png"
          },
          away_team: {
            espn_id: "5485",
            display_name: "Deportivo Pasto",
            abbreviation: "PAS",
            primary_logo: "https://img.example/pas.png"
          },
          home_score: null,
          away_score: null
        }
      ]
    });

    const viewModel = globalThis.CanonicalViewAdapter.buildStandingsViewModel(
      payload,
      "col.1"
    );

    assert.strictEqual(viewModel.leagueType, "col.1");
    assert.strictEqual(viewModel.competitionName, "Colombian Primera A");
    assert.strictEqual(viewModel.teams[0].name, "Atletico Nacional");
    assert.strictEqual(viewModel.teams[0].logo, "https://img.example/nal.png");
    assert.strictEqual(viewModel.fixtures[0].homeTeam, "Atletico Nacional");
    assert.strictEqual(
      viewModel.fixtures[0].awayLogo,
      "https://img.example/pas.png"
    );
    assert.strictEqual(viewModel.fixtures[0].score, "vs");
    assert.ok(viewModel.meta.lastUpdated);
  });

  it("does not infer the UEFA final stage from placeholder winner fixtures", () => {
    const payload = buildCanonicalStandingsPayload({
      leagueType: COMPETITION_KEYS.UEFA_CHAMPIONS,
      slug: getDefaultSlug(COMPETITION_KEYS.UEFA_CHAMPIONS),
      leagueName: "UEFA Champions League",
      leagueAbbreviation: "UCL",
      standingsResults: [
        {
          team_espn_id: "1",
          team_name: "Arsenal",
          team_abbreviation: "ARS",
          season_year: 2026,
          season_type: 1,
          rank: 1,
          wins: 8,
          losses: 0,
          ties: 0,
          points: 24,
          stats: [
            { name: "pointsFor", value: 23 },
            { name: "pointsAgainst", value: 4 },
            { name: "pointDifferential", value: 19 }
          ]
        }
      ],
      fixturesResults: [
        {
          id: "ucl-final",
          name: "Semifinal 2 Winner at Semifinal 1 Winner",
          date: "2026-05-30T16:00:00Z",
          status: "STATUS_SCHEDULED",
          venue_name: "Puskás Aréna",
          home_team: {
            espn_id: "9001",
            display_name: "Semifinal 1 Winner",
            primary_logo: ""
          },
          away_team: {
            espn_id: "9002",
            display_name: "Semifinal 2 Winner",
            primary_logo: ""
          },
          home_score: null,
          away_score: null
        }
      ]
    });

    assert.strictEqual(payload.fixtures.items.length, 1);
    assert.strictEqual(payload.fixtures.items[0].stage, null);
    assert.strictEqual(payload.fixtures.items[0].venue.name, "Puskás Aréna");
  });

  it("builds grouped legacy-shaped view models from canonical payloads", () => {
    const payload = buildCanonicalGroupedStandingsPayload({
      leagueType: COMPETITION_KEYS.FIFA_WORLD,
      slug: getDefaultSlug(COMPETITION_KEYS.FIFA_WORLD),
      leagueName: "FIFA World Cup",
      leagueAbbreviation: "FIFA World Cup",
      groupedData: {
        groups: {
          A: [
            {
              position: 1,
              name: "Mexico",
              logo: "https://img.example/mex.png",
              played: 3,
              won: 2,
              drawn: 1,
              lost: 0,
              goalsFor: 5,
              goalsAgainst: 2,
              goalDifference: 3,
              points: 7,
              form: ["W", "D", "W"]
            }
          ]
        },
        fixtures: [
          {
            homeTeam: "Mexico",
            awayTeam: "Japan",
            homeLogo: "https://img.example/mex.png",
            awayLogo: "https://img.example/jpn.png",
            date: "2026-06-11",
            time: "20:00",
            location: "Azteca",
            status: "",
            live: false,
            group: "A"
          }
        ],
        knockouts: {
          Rd16: [
            {
              homeTeam: "Mexico",
              awayTeam: "USA",
              date: "2026-06-28",
              time: "21:00",
              location: "Dallas",
              status: "",
              live: false
            }
          ]
        }
      }
    });

    const viewModel =
      globalThis.CanonicalViewAdapter.buildGroupedStandingsViewModel(
        payload,
        "fifa.world"
      );

    assert.strictEqual(viewModel.leagueType, "fifa.world");
    assert.strictEqual(viewModel.groups.A[0].name, "Mexico");
    assert.strictEqual(
      viewModel.groups.A[0].logo,
      "https://img.example/mex.png"
    );
    assert.strictEqual(viewModel.fixtures[0].group, "A");
    assert.strictEqual(viewModel.fixtures[0].location, "Azteca");
    assert.strictEqual(viewModel.knockouts.Rd16[0].homeTeam, "Mexico");
    assert.strictEqual(viewModel.knockouts.Rd16[0].location, "Dallas");
    assert.ok(viewModel.meta.lastUpdated);
  });
});
