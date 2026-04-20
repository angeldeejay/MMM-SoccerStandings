# CHANGELOG

## [v3.0.0] - 2026-04-19 - Module Rename, Bug Fixes & Architecture Refactor

### Problem
- **Module identity mismatch**: Directory renamed to `MMM-SoccerStandings` but `Module.register`, CSS file reference, and `package.json` still referenced old name `MMM-MyTeams-LeagueTable`, causing MagicMirror to silently fail loading the module.
- **Blank screen on league switch**: `_shouldSkipRender()` returned `true` during tab transitions due to stale render key comparison, causing `getDom()` to return an empty container.
- **Broken league selection**: Three independent bugs — `CYMRU_PREMIER_LEAGUE` key typo in `defaults.leagueHeaders`, `ENGLAND_PREMIER_LEAGUE` typo in `googleUrlMap`, and `NORTH MACEDONIA_FIRST_LEAGUE` key with a space in `european-leagues.js` — caused those leagues to fail URL resolution silently.
- **URL gap for EUROPEAN_LEAGUES-only leagues**: Leagues defined only in `european-leagues.js` (not in `bbcUrlMap`) had no URL resolved, preventing any fetch.
- **WC 2026 always starting on Semifinals tab**: `_inferUEFAStage()` (designed for UEFA competition stage detection) was incorrectly applied to World Cup fixture articles. It converted `"Round of 32"` stage strings to `"Playoff"`, corrupting fixture grouping and causing the wrong tab to appear active on load.
- **Auto-cycle ignoring WC default sub-tab**: When auto-cycling landed on `WORLD_CUP_2026`, `currentSubTab` was not reset, so the sub-tab persisted from whatever the user had selected last.
- **Duplicate team alias definitions**: The alias map (cabo verde → Cape Verde, etc.) was hardcoded identically in both `logo-resolver.js` (Node.js) and `MMM-SoccerStandings.js` (browser), requiring dual maintenance.
- **`LEAGUE_SPLITS` inside `Module.register`**: Split-league config was nested inside the module object, making it inaccessible to any code outside the MagicMirror module scope.
- **`form` field type mismatch**: `BaseParser._blankTeam()` returned `form: ""` (string) but all rendering code expected `form: []` (array), causing silent rendering failures for form badges.

### Solution
- **Module rename (P0)**: Updated `Module.register("MMM-SoccerStandings")`, `getStyles()` CSS reference, `package.json` name/main/scripts, and all log prefix strings in `node_helper.js`.
- **Removed `_shouldSkipRender`**: Deleted the function and all `_lastRenderedKey` references. `getDom()` now always renders current data — MagicMirror's own diffing handles unnecessary repaints.
- **Fixed league key typos**: Corrected `CYMRU_PREMIER_LEAGUE` in `defaults.leagueHeaders`, `ENGLAND_PREMIER_LEAGUE` in `googleUrlMap`, `NORTH_MACEDONIA_FIRST_LEAGUE` key in `european-leagues.js`, and removed duplicate `SERBIA_SUPER_LIGA` definition.
- **EUROPEAN_LEAGUES URL fallback**: `getLeagueUrl()` now checks `EUROPEAN_LEAGUES[leagueCode].url` as fallback when `bbcUrlMap` has no entry for a league code.
- **WC stage inference guard**: Added `skipStageInference` parameter to `BBCParser._parseBBCFixtureArticles()`. `FIFAParser.js` passes `true`, preventing `_inferUEFAStage()` from corrupting World Cup stage strings.
- **WC sub-tab reset on cycle**: `cycleFn` now resets `currentSubTab` to `config.defaultWCSubTab || "A"` when cycling to `WORLD_CUP_2026`.
- **Team aliases single source of truth**: Created `team-aliases.js` with dual-environment export pattern. `logo-resolver.js` now `require()`s it; the frontend loads it via `getScripts()`. Both environments reference the same 30-entry alias map.
- **`LEAGUE_SPLITS` to module scope**: Moved constant before `Module.register()` call so it is accessible globally.
- **`form` type fix**: `BaseParser._blankTeam()` now returns `form: []`.

### Files Modified
- `MMM-SoccerStandings.js` (renamed from `MMM-MyTeams-LeagueTable.js`): Module.register name, CSS ref, removed `_shouldSkipRender`, fixed key typos, EUROPEAN_LEAGUES URL fallback, WC cycle reset, LEAGUE_SPLITS moved to module scope, teamAliases from shared file.
- `node_helper.js`: Log prefix strings updated to `MMM-SoccerStandings`.
- `BBCParser.js`: `skipStageInference` parameter added to `_parseBBCFixtureArticles`.
- `FIFAParser.js`: Passes `skipStageInference = true` when calling `_parseBBCFixtureArticles`.
- `BaseParser.js`: `_blankTeam()` returns `form: []`.
- `european-leagues.js`: Fixed `NORTH_MACEDONIA_FIRST_LEAGUE` key, removed duplicate `SERBIA_SUPER_LIGA`.
- `logo-resolver.js`: Replaced inline alias map with `require("./team-aliases.js")`.
- `team-aliases.js`: **New file** — shared team alias map for both browser and Node.js.
- `package.json`: name, main, scripts, description updated.

---

## Earlier Versions

Refer to base repository [CHANGELOG.md](https://github.com/gitgitaway/MMM-MyTeams-LeagueTable/blob/main/CHANGELOG.md)
