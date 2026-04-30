const assert = require("assert");

const { COMPETITION_KEYS } = require("../constants/competition-keys.js");
const {
  initializeCanonicalProvider
} = require("../backend/canonical-provider-registry.js");
require("../backend/providers/espn-soccer-canonical-provider.js");

describe("Canonical provider integration", () => {
  it("initializes the active canonical provider through the registry", async () => {
    const provider = initializeCanonicalProvider("espn_service", {
      catalogCache: { fetchedAt: 0, bySlug: {} },
      collectPages(resp) {
        return resp.results;
      },
      async fetchJson(url) {
        if (url.includes("/api/v1/leagues/")) {
          return {
            results: [
              {
                slug: "col.1",
                name: "Colombian Primera A",
                abbreviation: "Colombian Primera A",
                has_legs: true
              }
            ]
          };
        }

        if (url.includes("/api/v1/standings/")) {
          return {
            results: [
              {
                team_espn_id: "5264",
                team_name: "Atletico Nacional",
                team_abbreviation: "NAL",
                season_year: 2026,
                rank: 1,
                wins: 13,
                losses: 3,
                ties: 1,
                points: 40,
                stats: {
                  pointsFor: {
                    value: 35,
                    displayValue: "35",
                    shortDisplayName: "F"
                  },
                  pointsAgainst: {
                    value: 13,
                    displayValue: "13",
                    shortDisplayName: "A"
                  },
                  pointDifferential: {
                    value: 22,
                    displayValue: "+22",
                    shortDisplayName: "GD"
                  }
                }
              }
            ]
          };
        }

        if (url.includes("/api/v1/fixtures/")) {
          return {
            results: [
              {
                id: "fix-1",
                date: "2026-04-24T20:00:00Z",
                status: "scheduled",
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
          };
        }

        throw new Error(`Unexpected URL in provider test: ${url}`);
      }
    });

    const payload = await provider.fetchCompetitionPayload({
      leagueType: COMPETITION_KEYS.COLOMBIA_PRIMERA,
      slug: "col.1",
      wantsFixtures: true,
      request: {
        providerSettings: {
          espn_service: { baseUrl: "http://localhost:28000", timeoutMs: 8000 }
        }
      }
    });

    assert.strictEqual(payload.competition.name, "Colombian Primera A");
    assert.strictEqual(
      payload.fixtures.items[0].home.logos.primary,
      "https://img.example/nal.png"
    );
  });

  it("builds grouped canonical payloads in the provider without external parsers", async () => {
    const provider = initializeCanonicalProvider("espn_service", {
      catalogCache: { fetchedAt: 0, bySlug: {} },
      collectPages(resp) {
        return resp.results;
      },
      async fetchJson(url) {
        if (url.includes("/api/v1/leagues/")) {
          return {
            results: [
              {
                slug: "fifa.world",
                name: "FIFA World Cup",
                abbreviation: "FIFA World Cup",
                has_legs: false
              }
            ]
          };
        }

        if (url.includes("/api/v1/standings/")) {
          return {
            results: [
              {
                team_espn_id: "101",
                team_name: "Mexico",
                group_name: "Group A",
                rank: 1,
                wins: 2,
                losses: 0,
                ties: 1,
                points: 7,
                stats: {
                  pointsFor: {
                    value: 5,
                    displayValue: "5",
                    shortDisplayName: "F"
                  },
                  pointsAgainst: {
                    value: 2,
                    displayValue: "2",
                    shortDisplayName: "A"
                  },
                  pointDifferential: {
                    value: 3,
                    displayValue: "+3",
                    shortDisplayName: "GD"
                  }
                }
              },
              {
                team_espn_id: "102",
                team_name: "Japan",
                group_name: "Group A",
                rank: 2,
                wins: 1,
                losses: 1,
                ties: 1,
                points: 4,
                stats: {
                  pointsFor: {
                    value: 3,
                    displayValue: "3",
                    shortDisplayName: "F"
                  },
                  pointsAgainst: {
                    value: 3,
                    displayValue: "3",
                    shortDisplayName: "A"
                  },
                  pointDifferential: {
                    value: 0,
                    displayValue: "0",
                    shortDisplayName: "GD"
                  }
                }
              }
            ]
          };
        }

        if (url.includes("/api/v1/fixtures/")) {
          return {
            results: [
              {
                name: "Mexico at Japan",
                date: "2026-06-11T20:00:00Z",
                status: "scheduled",
                venue_name: "Azteca",
                home_team: {
                  espn_id: "101",
                  display_name: "Mexico",
                  primary_logo: "https://img.example/mex.png"
                },
                away_team: {
                  espn_id: "102",
                  display_name: "Japan",
                  primary_logo: "https://img.example/jpn.png"
                },
                home_score: null,
                away_score: null
              },
              {
                name: "Round of 32 1 Winner at Round of 32 2 Winner",
                date: "2026-06-28T20:00:00Z",
                status: "scheduled",
                venue_name: "Dallas",
                home_team: {
                  espn_id: "101",
                  display_name: "Mexico",
                  primary_logo: "https://img.example/mex.png"
                },
                away_team: {
                  espn_id: "999",
                  display_name: "TBD",
                  primary_logo: ""
                },
                home_score: null,
                away_score: null
              },
              {
                name: "Semifinal 2 Winner at Semifinal 1 Winner",
                date: "2026-07-10T20:00:00Z",
                status: "scheduled",
                venue_name: "New York",
                home_team: {
                  espn_id: "998",
                  display_name: "Semifinal 1 Winner",
                  primary_logo: ""
                },
                away_team: {
                  espn_id: "999",
                  display_name: "Semifinal 2 Winner",
                  primary_logo: ""
                },
                home_score: null,
                away_score: null
              }
            ]
          };
        }

        throw new Error(`Unexpected URL in grouped provider test: ${url}`);
      }
    });

    const payload = await provider.fetchCompetitionPayload({
      leagueType: COMPETITION_KEYS.FIFA_WORLD,
      slug: "fifa.world",
      wantsFixtures: true,
      request: {
        providerSettings: {
          espn_service: { baseUrl: "http://localhost:28000", timeoutMs: 8000 }
        }
      }
    });

    assert.strictEqual(payload.standings.kind, "grouped");
    assert.strictEqual(
      payload.standings.groups[0].rows[0].team.logos.primary,
      "https://img.example/mex.png"
    );
    assert.strictEqual(payload.fixtures.items.length, 1);
    assert.strictEqual(payload.fixtures.items[0].venue.name, "Azteca");
    assert.strictEqual(payload.knockouts.rd16.length, 1);
    assert.strictEqual(payload.knockouts.rd16[0].venue.name, "Dallas");
    assert.strictEqual(payload.knockouts.final.length, 0);
    assert.strictEqual(payload.knockouts.tp.length, 0);
  });
});
