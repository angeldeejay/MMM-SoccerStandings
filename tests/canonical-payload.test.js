const assert = require("assert");

const { COMPETITION_KEYS } = require("../constants/competition-keys.js");
const {
  buildCanonicalGroupedStandingsPayload,
  buildCanonicalStandingsPayload,
  getDefaultSlug,
  isSupportedCanonicalCompetition,
  resolveEspnSoccerApiConfig
} = require("../backend/slice1-flat-standings.js");

describe("Canonical payload building", () => {
  it("resolves the ESPN service config from top-level request fields", () => {
    assert.deepStrictEqual(
      resolveEspnSoccerApiConfig({
        espnSoccerApiBaseUrl: "http://127.0.0.1:3200/",
        espnSoccerApiTimeout: 4321
      }),
      {
        baseUrl: "http://127.0.0.1:3200",
        timeoutMs: 4321
      }
    );
  });

  it("limits canonical support to the narrowed active competitions", () => {
    assert.strictEqual(isSupportedCanonicalCompetition("col.1"), true);
    assert.strictEqual(isSupportedCanonicalCompetition("uefa.champions"), true);
    assert.strictEqual(isSupportedCanonicalCompetition("fifa.world"), true);
    assert.strictEqual(isSupportedCanonicalCompetition("eng.1"), false);
  });

  it("embeds catalog navigation into flat canonical payloads", () => {
    const payload = buildCanonicalStandingsPayload({
      leagueType: COMPETITION_KEYS.COLOMBIA_PRIMERA,
      slug: "col.1",
      leagueName: "Colombian Primera A",
      leagueAbbreviation: "Colombian Primera A",
      leagueLogos: null,
      competitionNavigation: {
        source: "catalog",
        seasonYear: 2026,
        subTabs: [
          { id: "apertura", label: "Apertura", type: "phase" },
          { id: "A", label: "Group A", type: "group" }
        ]
      },
      standingsResults: [
        {
          team_espn_id: "5264",
          team_name: "Atlético Nacional",
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
      ]
    });

    assert.deepStrictEqual(payload.competition.navigation, {
      source: "catalog",
      seasonYear: 2026,
      subTabs: [
        { id: "apertura", label: "Apertura", type: "phase" },
        { id: "A", label: "Group A", type: "group" }
      ]
    });
  });

  it("embeds catalog navigation into grouped canonical payloads", () => {
    const payload = buildCanonicalGroupedStandingsPayload({
      leagueType: COMPETITION_KEYS.FIFA_WORLD,
      slug: "fifa.world",
      leagueName: "FIFA World Cup",
      leagueAbbreviation: "FIFA World Cup",
      leagueLogos: null,
      competitionNavigation: {
        source: "catalog",
        seasonYear: 2026,
        subTabs: [
          { id: "A", label: "Group A", type: "group" },
          { id: "final", label: "Final", type: "phase" }
        ]
      },
      groupedData: {
        groups: {
          A: [
            {
              name: "Mexico",
              played: 0,
              won: 0,
              drawn: 0,
              lost: 0,
              points: 0,
              goalsFor: 0,
              goalsAgainst: 0,
              goalDifference: 0,
              form: []
            }
          ]
        },
        fixtures: [],
        knockouts: {}
      }
    });

    assert.deepStrictEqual(payload.competition.navigation, {
      source: "catalog",
      seasonYear: 2026,
      subTabs: [
        { id: "A", label: "Group A", type: "group" },
        { id: "final", label: "Final", type: "phase" }
      ]
    });
  });

  it("builds flat canonical standings payloads for col.1", () => {
    const payload = buildCanonicalStandingsPayload({
      leagueType: COMPETITION_KEYS.COLOMBIA_PRIMERA,
      slug: getDefaultSlug(COMPETITION_KEYS.COLOMBIA_PRIMERA),
      leagueName: "Colombian Primera A",
      leagueAbbreviation: "Colombian Primera A",
      leagueLogos: {
        primary: "https://img.example/col-primary.png",
        dark: "https://img.example/col-dark.png",
        default: "https://img.example/col-default.png"
      },
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

    assert.strictEqual(
      payload.competition.code,
      COMPETITION_KEYS.COLOMBIA_PRIMERA
    );
    assert.strictEqual(payload.competition.slug, "col.1");
    assert.strictEqual(payload.competition.name, "Colombian Primera A");
    assert.strictEqual(payload.competition.abbreviation, "Colombian Primera A");
    assert.deepStrictEqual(payload.competition.logos, {
      primary: "https://img.example/col-primary.png",
      dark: "https://img.example/col-dark.png",
      default: "https://img.example/col-default.png",
      light: null
    });
    assert.strictEqual(payload.standings.kind, "flat");
    assert.strictEqual(payload.standings.rows.length, 1);
    assert.strictEqual(
      payload.standings.rows[0].team.logos.primary,
      "https://img.example/nal.png"
    );
    assert.strictEqual(payload.fixtures.items.length, 1);
    assert.strictEqual(payload.state.status, "ready");
    assert.strictEqual(
      payload.fixtures.items[0].home.name,
      "Atletico Nacional"
    );
    assert.strictEqual(payload.fixtures.items[0].away.name, "Deportivo Pasto");
  });

  it("builds grouped canonical payloads for fifa.world without legacy parser data", () => {
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

    assert.strictEqual(payload.competition.code, COMPETITION_KEYS.FIFA_WORLD);
    assert.strictEqual(payload.competition.slug, "fifa.world");
    assert.strictEqual(payload.competition.name, "FIFA World Cup");
    assert.strictEqual(payload.competition.abbreviation, "FIFA World Cup");
    assert.strictEqual(payload.standings.kind, "grouped");
    assert.strictEqual(payload.standings.groups.length, 1);
    assert.strictEqual(payload.fixtures.items.length, 1);
    assert.strictEqual(payload.knockouts.Rd16.length, 1);
    assert.strictEqual(payload.state.status, "ready");
  });
});
