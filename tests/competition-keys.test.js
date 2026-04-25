const assert = require("assert");

const {
  COMPETITION_KEYS,
  getCompetitionKey,
  getCompetitionValue
} = require("../constants/competition-keys.js");

describe("Competition key resolution", () => {
  it("resolves active competition keys and provider slugs bidirectionally", () => {
    assert.strictEqual(
      getCompetitionValue(COMPETITION_KEYS.COLOMBIA_PRIMERA, "espn_service"),
      "col.1"
    );
    assert.strictEqual(
      getCompetitionValue(COMPETITION_KEYS.UEFA_CHAMPIONS, "espn_service"),
      "uefa.champions"
    );
    assert.strictEqual(
      getCompetitionKey("fifa.world", "espn_service"),
      COMPETITION_KEYS.FIFA_WORLD
    );
    assert.strictEqual(
      getCompetitionKey("col.1", "espn_service"),
      COMPETITION_KEYS.COLOMBIA_PRIMERA
    );
    assert.strictEqual(
      getCompetitionKey("UEFA_CHAMPIONS_LEAGUE", "espn_service"),
      COMPETITION_KEYS.UEFA_CHAMPIONS
    );
    assert.strictEqual(
      getCompetitionKey("WORLD_CUP_2026", "espn_service"),
      COMPETITION_KEYS.FIFA_WORLD
    );
  });
});
