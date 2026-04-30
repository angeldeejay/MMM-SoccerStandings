const assert = require("assert");

const { loadRegisteredModuleDefinition } = require("./helpers/setup.js");

const moduleDefinition = loadRegisteredModuleDefinition();

describe("Module shell helpers", () => {
  it("uses fixed subtab order derived from the competition", () => {
    const moduleInstance = Object.assign({}, moduleDefinition, {
      config: {}
    });

    assert.deepStrictEqual(moduleInstance.getCompetitionSubTabs("col.1"), [
      "Table",
      "Fixtures"
    ]);
    assert.deepStrictEqual(
      moduleInstance.getCompetitionSubTabs("uefa.champions"),
      ["Table", "QF", "SF", "Final"]
    );
    assert.deepStrictEqual(moduleInstance.getCompetitionSubTabs("fifa.world"), [
      "A",
      "B",
      "C",
      "D",
      "E",
      "F",
      "G",
      "H",
      "I",
      "J",
      "K",
      "L",
      "Rd32",
      "Rd16",
      "QF",
      "SF",
      "TP",
      "Final"
    ]);
    assert.strictEqual(
      moduleInstance.getDefaultCompetitionSubTab("fifa.world"),
      "A"
    );
  });

  it("prefers canonical subtab navigation when available", () => {
    const moduleInstance = Object.assign({}, moduleDefinition, {
      config: {},
      currentLeague: "col.1",
      currentSubTab: "apertura",
      getCanonicalCompetitionSubTabs(leagueCode) {
        if (leagueCode === "col.1") {
          return [
            { id: "apertura", label: "Apertura", type: "phase" },
            { id: "A", label: "Group A", type: "group" }
          ];
        }

        return [];
      },
      getCompetitionSubTabs() {
        return ["Table", "Fixtures"];
      },
      translate(key) {
        return key;
      }
    });

    assert.deepStrictEqual(
      moduleInstance.getVisibleCompetitionSubTabs("col.1"),
      ["apertura", "A"]
    );
    assert.strictEqual(
      moduleInstance.getDefaultCompetitionSubTab("col.1"),
      "apertura"
    );
    assert.strictEqual(
      moduleInstance.getCompetitionSubTabLabel("col.1", "apertura"),
      "Apertura"
    );
    assert.strictEqual(
      moduleInstance.getCompetitionSubTabAriaLabel("col.1", "apertura"),
      "Show Apertura fixtures"
    );

    const templateData = moduleInstance.buildSubTabsTemplateData();
    assert.deepStrictEqual(
      templateData.map((tab) => ({
        id: tab.id,
        label: tab.label,
        type: tab.type,
        active: tab.active
      })),
      [
        { id: "apertura", label: "Apertura", type: "phase", active: true },
        { id: "A", label: "Group A", type: "group", active: false }
      ]
    );
  });

  it("maps canonical tournament phases back to legacy stage ids for rendering", () => {
    const moduleInstance = Object.assign({}, moduleDefinition, {
      config: {},
      currentLeague: "fifa.world",
      currentSubTab: "round-of-16",
      getCanonicalCompetitionSubTabs(leagueCode) {
        if (leagueCode === "fifa.world") {
          return [
            {
              id: "round-of-16",
              label: "Round of 16",
              type: "phase",
              phaseSlug: "round-of-16",
              phaseLabel: "Round of 16"
            }
          ];
        }

        return [];
      },
      isWorldCupLeague() {
        return true;
      },
      isUEFATournamentLeague() {
        return false;
      },
      getLeagueDisplayName() {
        return "FIFA World Cup";
      },
      translate(key) {
        return key;
      }
    });

    assert.strictEqual(
      moduleInstance.getCompetitionSubTabRuntimeId("fifa.world", "round-of-16"),
      "Rd16"
    );
    assert.strictEqual(
      moduleInstance.getCurrentLeagueTitle(),
      "FIFA World Cup • Round of 16"
    );
  });

  it("shows league buttons only when more than one league is configured", () => {
    const moduleInstance = Object.assign({}, moduleDefinition, {
      enabledLeagueCodes: ["uefa.champions"]
    });

    assert.strictEqual(moduleInstance.shouldShowLeagueButtons(), false);
    moduleInstance.enabledLeagueCodes.push("fifa.world");
    assert.strictEqual(moduleInstance.shouldShowLeagueButtons(), true);
  });

  it("uses the MagicMirror template shell for reusable chrome", () => {
    const moduleInstance = Object.assign({}, moduleDefinition);

    assert.strictEqual(
      moduleInstance.getTemplate(),
      "templates/MMM-SoccerStandings.njk"
    );
  });

  it("builds template data that preserves configured league order and cycle controls", () => {
    const moduleInstance = Object.assign({}, moduleDefinition, {
      config: {
        cycle: true
      },
      isOnline: true,
      identifier: "test-id",
      currentLeague: "fifa.world",
      currentSubTab: "A",
      enabledLeagueCodes: ["col.1", "fifa.world", "uefa.champions"],
      shouldShowLeagueButtons() {
        return true;
      },
      getRenderLeagueData() {
        return null;
      },
      getLeagueInfo(leagueCode) {
        return {
          name: leagueCode,
          abbreviation: leagueCode.toUpperCase(),
          logo: null
        };
      },
      getLeagueDisplayName(leagueCode) {
        return leagueCode;
      },
      translate(key) {
        return key;
      }
    });

    const templateData = moduleInstance.getTemplateData();

    assert.deepStrictEqual(
      templateData.leagueTabs.map((tab) => tab.leagueCode),
      ["col.1", "fifa.world", "uefa.champions"]
    );
    assert.strictEqual(
      templateData.header.actionButtons.some(
        (button) => button.action === "toggle-cycle"
      ),
      true
    );
    assert.strictEqual(templateData.subTabs[0].id, "A");
  });

  it("keeps visible subtabs aligned with the structural competition order", () => {
    const moduleInstance = Object.assign({}, moduleDefinition, {
      config: {}
    });

    assert.deepStrictEqual(
      moduleInstance.getVisibleCompetitionSubTabs("fifa.world"),
      [
        "A",
        "B",
        "C",
        "D",
        "E",
        "F",
        "G",
        "H",
        "I",
        "J",
        "K",
        "L",
        "Rd32",
        "Rd16",
        "QF",
        "SF",
        "TP",
        "Final"
      ]
    );
  });

  it("cycles through visible subtabs before moving to the next league", () => {
    const moduleInstance = Object.assign({}, moduleDefinition, {
      config: {},
      enabledLeagueCodes: ["uefa.champions", "col.1"],
      currentLeague: "uefa.champions",
      currentSubTab: "Table",
      getVisibleCompetitionSubTabs(leagueCode) {
        if (leagueCode === "uefa.champions") {
          return ["Table", "QF", "SF"];
        }
        if (leagueCode === "col.1") {
          return ["Table"];
        }
        return [];
      },
      getDefaultCompetitionSubTab(leagueCode) {
        const subTabs = this.getVisibleCompetitionSubTabs(leagueCode);
        return subTabs.length ? subTabs[0] : null;
      }
    });

    assert.deepStrictEqual(moduleInstance.getNextCycleTarget(), {
      league: "uefa.champions",
      subTab: "QF",
      type: "SUB_TAB"
    });

    moduleInstance.currentSubTab = "SF";

    assert.deepStrictEqual(moduleInstance.getNextCycleTarget(), {
      league: "col.1",
      subTab: "Table",
      type: "LEAGUE"
    });
  });

  it("formats countdown values with compact large-number suffixes", () => {
    const moduleInstance = Object.assign({}, moduleDefinition);

    assert.strictEqual(moduleInstance.formatCompactNumber(15), "15");
    assert.strictEqual(moduleInstance.formatCompactNumber(999), "999");
    assert.strictEqual(moduleInstance.formatCompactNumber(1000), "1K");
    assert.strictEqual(moduleInstance.formatCompactNumber(1500), "1.5K");
    assert.strictEqual(moduleInstance.formatCompactNumber(1250000), "1.3M");
  });

  it("formats fixture card dates as DD/MM", () => {
    const moduleInstance = Object.assign({}, moduleDefinition);

    assert.strictEqual(
      moduleInstance.formatFixtureDateLabel({ date: "2026-07-05" }),
      "05/07"
    );
  });

  it("builds fixture card display data for upcoming and aggregate fixtures", () => {
    const moduleInstance = Object.assign({}, moduleDefinition, {
      getCurrentDateString() {
        return "2026-04-28";
      }
    });

    const upcomingDisplay = moduleInstance.getFixtureDisplayModel({
      date: "2026-04-29",
      time: "19:30"
    });
    assert.strictEqual(upcomingDisplay.isUpcoming, true);
    assert.strictEqual(upcomingDisplay.mainText, "vs");

    const aggregateDisplay = moduleInstance.getFixtureDisplayModel({
      date: "2026-04-27",
      status: "95'",
      live: true,
      homeScore: 2,
      awayScore: 1,
      aggregateScore: "3 - 2"
    });
    assert.strictEqual(aggregateDisplay.isLive, true);
    assert.strictEqual(aggregateDisplay.mainText, "2 - 1");
    assert.strictEqual(aggregateDisplay.aggregateText, "3 - 2");
  });

  it("recognizes canonical fixture statuses from the endpoint contract", () => {
    const moduleInstance = Object.assign({}, moduleDefinition, {
      getCurrentDateString() {
        return "2026-04-28";
      }
    });

    assert.deepStrictEqual(
      moduleInstance.getFixtureStateFlags({
        status: "scheduled",
        date: "2026-04-29"
      }),
      { isFinished: false, isLive: false, isUpcoming: true }
    );
    assert.deepStrictEqual(
      moduleInstance.getFixtureStateFlags({
        status: "in_progress",
        date: "2026-04-28"
      }),
      { isFinished: false, isLive: true, isUpcoming: false }
    );
    assert.deepStrictEqual(
      moduleInstance.getFixtureStateFlags({
        status: "final",
        date: "2026-04-27"
      }),
      { isFinished: true, isLive: false, isUpcoming: false }
    );
    assert.deepStrictEqual(
      moduleInstance.getFixtureStateFlags({
        status: "postponed",
        date: "2026-04-29"
      }),
      { isFinished: false, isLive: false, isUpcoming: true }
    );
    assert.deepStrictEqual(
      moduleInstance.getFixtureStateFlags({
        status: "cancelled",
        date: "2026-04-29"
      }),
      { isFinished: false, isLive: false, isUpcoming: true }
    );
  });

  it("uses fixture marquee defaults and enables paging only when needed", () => {
    const moduleInstance = Object.assign({}, moduleDefinition, {
      config: {
        marqueePageSize: 3,
        marqueePageInterval: 3
      }
    });

    assert.strictEqual(moduleDefinition.defaults.marqueePageSize, 3);
    assert.strictEqual(moduleDefinition.defaults.marqueePageInterval, 3);
    assert.strictEqual(moduleInstance.getMarqueePageSize(), 3);
    assert.strictEqual(moduleInstance.getMarqueePageIntervalMs(), 3000);
    assert.strictEqual(
      moduleInstance.getFixtureMarqueeViewportHeight(),
      "calc(3 * var(--mtlt-fixture-card-row-height))"
    );
    assert.strictEqual(moduleInstance.shouldEnableFixtureMarquee(3), false);
    assert.strictEqual(moduleInstance.shouldEnableFixtureMarquee(4), true);
  });

  it("orders result fixtures from most recent to oldest", () => {
    const moduleInstance = Object.assign({}, moduleDefinition);

    assert.deepStrictEqual(
      moduleInstance.getMostRecentFixturesFirst([
        { id: 1 },
        { id: 2 },
        { id: 3 }
      ]),
      [{ id: 3 }, { id: 2 }, { id: 1 }]
    );
  });

  it("treats cycle as enabled unless it is explicitly false", () => {
    const moduleInstance = Object.assign({}, moduleDefinition, {
      config: {}
    });

    assert.strictEqual(moduleDefinition.defaults.cycle, true);
    assert.strictEqual(moduleInstance.isCycleEnabled(), true);

    moduleInstance.config.cycle = null;
    assert.strictEqual(moduleInstance.isCycleEnabled(), true);

    moduleInstance.config.cycle = false;
    assert.strictEqual(moduleInstance.isCycleEnabled(), false);
  });

  it("clamps configured form games between one and five", () => {
    const moduleInstance = Object.assign({}, moduleDefinition, {
      config: {
        formMaxGames: 8
      }
    });

    assert.strictEqual(moduleInstance.getConfiguredFormGameCount(), 5);
    assert.strictEqual(moduleInstance.getFormCountClass(), "form-count-5");

    moduleInstance.config.formMaxGames = 0;
    assert.strictEqual(moduleInstance.getConfiguredFormGameCount(), 1);

    moduleInstance.config.formMaxGames = 3.8;
    assert.strictEqual(moduleInstance.getConfiguredFormGameCount(), 3);

    moduleInstance.config.formMaxGames = undefined;
    assert.strictEqual(
      moduleInstance.getConfiguredFormGameCount(),
      moduleDefinition.defaults.formMaxGames
    );
  });

  it("does not expose retired customization flags in defaults", () => {
    [
      "autoFocusRelevantSubTab",
      "showPosition",
      "fixtureDateFilter",
      "customTeamColors",
      "leagueHeaders",
      "fontColorOverride",
      "opacityOverride",
      "debug",
      "dateTimeOverride",
      "highlightedColor"
    ].forEach((key) => {
      assert.ok(
        !(key in moduleDefinition.defaults),
        `${key} should be retired`
      );
    });
  });

  it("falls back to staged flat fixtures when a knockout tab has no structured bucket", () => {
    const moduleInstance = Object.assign({}, moduleDefinition);
    const fixtures = [
      { id: "sf-1", stage: "SF" },
      { id: "final-1", stage: "Final" }
    ];

    assert.deepStrictEqual(
      moduleInstance.getKnockoutFixturesForSubTab(
        { fixtures, knockouts: {} },
        "Final"
      ),
      [{ id: "final-1", stage: "Final" }]
    );
  });

  it("normalizes legacy configured league identifiers into live provider codes", () => {
    const moduleInstance = Object.assign({}, moduleDefinition, {
      config: {
        provider: "espn_service",
        selectedLeagues: [
          "UEFA_CHAMPIONS_LEAGUE",
          "COLOMBIA_PRIMERA",
          "WORLD_CUP_2026"
        ]
      },
      currentLeague: null,
      enabledLeagueCodes: [],
      competitionProvider: null
    });

    moduleInstance.determineEnabledLeagues();

    assert.deepStrictEqual(moduleInstance.enabledLeagueCodes, [
      "uefa.champions",
      "col.1",
      "fifa.world"
    ]);
  });
});
