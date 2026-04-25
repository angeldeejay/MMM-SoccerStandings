const assert = require("assert");

const {
  buildCompetitionNavigation,
  buildCompetitionCatalogIndex,
  getCompetitionCatalogEntry
} = require("../backend/competition-catalog.js");

describe("Competition catalog and navigation", () => {
  it("indexes competition names and abbreviations from the API catalog", () => {
    const catalog = buildCompetitionCatalogIndex([
      {
        slug: "col.1",
        name: "Colombian Primera A",
        abbreviation: "Colombian Primera A",
        primary_logo: "https://img.example/col-primary.png",
        logos: [
          {
            rel: ["full", "default"],
            href: "https://img.example/col-default.png"
          },
          {
            rel: ["full", "dark"],
            href: "https://img.example/col-dark.png"
          }
        ],
        has_legs: true,
        phases: [
          {
            id: 141,
            name: "Apertura - Semifinals",
            slug: "apertura---semifinals",
            season_year: 2026,
            current: false,
            has_groups: true,
            espn_id: "2",
            espn_type: 13941,
            start_date: "2026-05-27T04:00:00Z",
            end_date: "2026-06-21T03:59:00Z"
          },
          {
            id: 140,
            name: "Apertura",
            slug: "apertura",
            season_year: 2026,
            current: true,
            has_groups: false,
            espn_id: "1",
            espn_type: 13942,
            start_date: "2026-01-01T05:00:00Z",
            end_date: "2026-05-27T03:59:00Z"
          }
        ],
        groups: [
          {
            id: 91,
            phase_id: 141,
            phase_espn_id: "2",
            phase_slug: "apertura---semifinals",
            phase_name: "Apertura - Semifinals",
            espn_id: "2",
            uid: "s:600~l:650~g:2",
            name: "Group B",
            abbreviation: "Group B",
            season_year: 2026
          },
          {
            id: 88,
            phase_id: 141,
            phase_espn_id: "2",
            phase_slug: "apertura---semifinals",
            phase_name: "Apertura - Semifinals",
            espn_id: "1",
            uid: "s:600~l:650~g:1",
            name: "Group A",
            abbreviation: "Group A",
            season_year: 2026
          }
        ]
      },
      {
        slug: "fifa.world",
        name: "FIFA World Cup",
        abbreviation: "FIFA World Cup",
        has_legs: false
      }
    ]);

    assert.deepStrictEqual(getCompetitionCatalogEntry(catalog, "col.1"), {
      slug: "col.1",
      name: "Colombian Primera A",
      abbreviation: "Colombian Primera A",
      logos: {
        primary: "https://img.example/col-primary.png",
        dark: "https://img.example/col-dark.png",
        default: "https://img.example/col-default.png",
        light: null
      },
      hasLegs: true,
      phases: [
        {
          id: 140,
          name: "Apertura",
          slug: "apertura",
          seasonYear: 2026,
          current: true,
          hasGroups: false,
          espnId: "1",
          espnType: 13942,
          startDate: "2026-01-01T05:00:00Z",
          endDate: "2026-05-27T03:59:00Z"
        },
        {
          id: 141,
          name: "Apertura - Semifinals",
          slug: "apertura---semifinals",
          seasonYear: 2026,
          current: false,
          hasGroups: true,
          espnId: "2",
          espnType: 13941,
          startDate: "2026-05-27T04:00:00Z",
          endDate: "2026-06-21T03:59:00Z"
        }
      ],
      groups: [
        {
          id: 88,
          phaseId: 141,
          phaseEspnId: "2",
          phaseSlug: "apertura---semifinals",
          phaseName: "Apertura - Semifinals",
          espnId: "1",
          uid: "s:600~l:650~g:1",
          name: "Group A",
          abbreviation: "Group A",
          seasonYear: 2026
        },
        {
          id: 91,
          phaseId: 141,
          phaseEspnId: "2",
          phaseSlug: "apertura---semifinals",
          phaseName: "Apertura - Semifinals",
          espnId: "2",
          uid: "s:600~l:650~g:2",
          name: "Group B",
          abbreviation: "Group B",
          seasonYear: 2026
        }
      ]
    });
    assert.deepStrictEqual(getCompetitionCatalogEntry(catalog, "FIFA.WORLD"), {
      slug: "fifa.world",
      name: "FIFA World Cup",
      abbreviation: "FIFA World Cup",
      logos: null,
      hasLegs: false,
      phases: [],
      groups: []
    });
  });

  it("builds World Cup navigation by expanding grouped phases", () => {
    const navigation = buildCompetitionNavigation({
      slug: "fifa.world",
      phases: [
        {
          id: 326,
          name: "Group Stage",
          slug: "group-stage",
          seasonYear: 2026,
          hasGroups: true,
          espnId: "1",
          startDate: "2026-06-11T04:00:00Z"
        },
        {
          id: 345,
          name: "Round of 32",
          slug: "round-of-32",
          seasonYear: 2026,
          hasGroups: false,
          espnId: "2",
          startDate: "2026-06-28T04:00:00Z"
        },
        {
          id: 350,
          name: "Final",
          slug: "final",
          seasonYear: 2026,
          hasGroups: false,
          espnId: "7",
          startDate: "2026-07-19T04:00:00Z"
        }
      ],
      groups: [
        {
          id: 217,
          phaseId: 326,
          phaseSlug: "group-stage",
          phaseEspnId: "1",
          espnId: "10",
          name: "Group J",
          abbreviation: "Group J",
          seasonYear: 2026
        },
        {
          id: 187,
          phaseId: 326,
          phaseSlug: "group-stage",
          phaseEspnId: "1",
          espnId: "1",
          name: "Group A",
          abbreviation: "Group A",
          seasonYear: 2026
        },
        {
          id: 188,
          phaseId: 326,
          phaseSlug: "group-stage",
          phaseEspnId: "1",
          espnId: "2",
          name: "Group B",
          abbreviation: "Group B",
          seasonYear: 2026
        }
      ]
    });

    assert.deepStrictEqual(
      navigation.subTabs.map((tab) => tab.id),
      ["A", "B", "J", "round-of-32", "final"]
    );
    assert.strictEqual(navigation.subTabs[0].type, "group");
    assert.strictEqual(navigation.subTabs[0].phaseSlug, "group-stage");
    assert.strictEqual(navigation.subTabs[3].type, "phase");
  });

  it("builds Colombian Primera navigation with grouped phases expanded", () => {
    const navigation = buildCompetitionNavigation({
      slug: "col.1",
      phases: [
        {
          id: 140,
          name: "Apertura",
          slug: "apertura",
          seasonYear: 2026,
          hasGroups: false,
          espnId: "1",
          startDate: "2026-01-01T05:00:00Z"
        },
        {
          id: 141,
          name: "Apertura - Semifinals",
          slug: "apertura---semifinals",
          seasonYear: 2026,
          hasGroups: true,
          espnId: "2",
          startDate: "2026-05-27T04:00:00Z"
        }
      ],
      groups: [
        {
          id: 88,
          phaseId: 141,
          phaseSlug: "apertura---semifinals",
          phaseEspnId: "2",
          espnId: "1",
          name: "Group A",
          abbreviation: "Group A",
          seasonYear: 2026
        }
      ]
    });

    assert.deepStrictEqual(
      navigation.subTabs.map((tab) => ({ id: tab.id, type: tab.type })),
      [
        { id: "apertura", type: "phase" },
        { id: "A", type: "group" }
      ]
    );
    assert.strictEqual(
      navigation.subTabs[1].phaseSlug,
      "apertura---semifinals"
    );
  });
});
