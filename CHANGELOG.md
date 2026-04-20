# CHANGELOG

## [v3.0.5] - 2026-04-20 - Documentation Cleanup & WC2026 Config Fix

### Problem
- **`WORLD_CUP_2026` invisible by default**: `showWC2026: false` default meant the `=== false` guard always triggered, filtering WC2026 out of `enabledLeagueCodes` even when explicitly listed in `selectedLeagues`. Same bug affected `showUEFAleagues`.
- **README and docs referenced removed options**: `legacyLeagueToggle`, `showSPFL`, `showSPFLC`, `showEPL`, `showUCL`, `showUEL`, `showECL` still appeared in example configs and config reference tables. `showWC2026`/`showUEFAleagues` defaults shown as `false` rather than `null`.
- **`bbcLeaguesPages.md`** used old `showXXX` identifiers in the "League Code" column for leagues that have proper `selectedLeagues` codes.
- **All documentation files** still referenced old module name `MMM-MyTeams-LeagueTable`.

### Solution
- **`showWC2026` default → `null`**: Strict `=== false` check now only fires on explicit user opt-out. `null` = no-op; `selectedLeagues` is the sole source of truth.
- **`showUEFAleagues` default → `null`**: Same fix.
- **`README.md`**: Removed legacy config block (Method 2, `legacyLeagueToggle`, `showSPFL`/`showSPFLC`/`showEPL`/`showUCL`/`showUEL`/`showECL`); removed `legacyLeagueToggle` row from config table; updated `showWC2026`/`showUEFAleagues` defaults and descriptions to reflect three-state semantics (`null`/`true`/`false`).
- **`documentation/Configuration_User_Guide.md`**: Same removals and updates; fixed UEFA example config; updated module name.
- **`documentation/WorldCup2026-UserGuide.md`**: Replaced `showWC2026: true` + `legacyLeagueToggle` with `selectedLeagues: ["WORLD_CUP_2026"]` as canonical approach; updated module name.
- **`documentation/bbcLeaguesPages.md`**: Column header `showLeague` → `League Code`; updated `showEPL`, `showSPFL`, `showSPFLC`, `showSerieA`, `showLaLiga`, `showBundesliga`, `showLigue1`, `showEredivisie`, `showEliteserien`, `showAllsvenskan`, `showSwissSuperLeague`, `showSuperLig`, `showUPL`, `showPrimeiraLiga`, `showBelgianProLeague`, `showSuperliga` to proper `ENGLAND_PREMIER_LEAGUE`, `SCOTLAND_PREMIERSHIP`, `SCOTLAND_CHAMPIONSHIP`, `ITALY_SERIE_A`, `SPAIN_LA_LIGA`, `GERMANY_BUNDESLIGA`, `FRANCE_LIGUE1`, `NETHERLANDS_EREDIVISIE`, `NORWAY_ELITESERIEN`, `SWEDEN_ALLSVENSKAN`, `SWITZERLAND_SUPER_LEAGUE`, `TURKEY_SUPER_LIG`, `UKRAINE_PREMIER_LEAGUE`, `PORTUGAL_PRIMEIRA_LIGA`, `BELGIUM_PRO_LEAGUE`, `DENMARK_SUPERLIGAEN` league codes.
- **All 18 documentation files**: `MMM-MyTeams-LeagueTable` → `MMM-SoccerStandings` (module rename propagated).

### Files Modified
- `MMM-SoccerStandings.js`: `showWC2026` default `false` → `null`; `showUEFAleagues` default `false` → `null`.
- `README.md`: Legacy config block removed; config tables updated.
- `documentation/Configuration_User_Guide.md`: Legacy entries removed; defaults corrected.
- `documentation/WorldCup2026-UserGuide.md`: Config examples updated; module name fixed.
- `documentation/bbcLeaguesPages.md`: League codes updated; column header corrected.
- All `documentation/*.md`: Module name updated from `MMM-MyTeams-LeagueTable` to `MMM-SoccerStandings`.

---

## [v3.0.4] - 2026-04-20 - Directory Scaffolding (constants/ and parsers/)

### Problem
- Root directory contained 30+ files — constants, parsers, helpers, and module entry points all flat, making navigation and maintenance increasingly difficult.

### Solution
- **`constants/`** — all pure data files moved here: `european-leagues.js`, `team-aliases.js`, `league-splits.js`, `league-urls.js`, `team-logo-mappings.js`.
- **`parsers/`** — all parser classes moved here: `BaseParser.js`, `BBCParser.js`, `ESPNParser.js`, `FIFAParser.js`, `GoogleParser.js`, `SoccerwayParser.js`, `WikipediaParser.js`.
- Updated all `require()` paths in `node_helper.js` and `logo-resolver.js`.
- Updated `getScripts()` paths in `MMM-SoccerStandings.js` (browser loads constants via `modules/<name>/constants/<file>.js`).
- Parsers require each other using `./` relative paths — already correct since they share the same directory.
- Updated `package.json` lint and format scripts to include `parsers/*.js` and `constants/*.js`.
- Lint passes zero errors, zero warnings across all directories.

### Files Modified
- `node_helper.js`: Parser requires updated to `./parsers/<Parser>.js`.
- `logo-resolver.js`: Constants requires updated to `./constants/<file>.js`.
- `MMM-SoccerStandings.js`: `getScripts()` paths updated to `constants/<file>.js`.
- `package.json`: `lint` and `format` scripts extended to cover subdirectories.

---

## [v3.0.3] - 2026-04-20 - Constants Modularization

### Problem
- `LEAGUE_SPLITS` (~550 lines) and five provider URL maps (~260 lines total) were inlined directly in `MMM-SoccerStandings.js`, making the file harder to navigate and making it impossible to share these constants with Node.js code.
- No single file was responsible for URL maintenance — season-specific URLs (Wikipedia, Soccerway) and stable URLs (BBC, ESPN) were buried inside a method body.

### Solution
- **`league-splits.js`** (new): Extracts `LEAGUE_SPLITS` constant. Dual-environment export — browser loads it as a global via `getScripts()`; Node.js can `require()` it directly.
- **`league-urls.js`** (new): Extracts all five provider URL maps (`bbc`, `wikipedia`, `soccerway`, `google`, `espn`) into a single `LEAGUE_URL_MAPS` object. Same dual-environment pattern. Season-specific URLs are now in one dedicated file.
- **`MMM-SoccerStandings.js`**: Removed the ~810-line inline constant block. `getScripts()` now loads `league-splits.js` and `league-urls.js`. `getLeagueUrl()` replaces five `const xxxUrlMap = {...}` blocks with a single destructure: `const { bbc: bbcUrlMap, ... } = LEAGUE_URL_MAPS`.
- **`eslint.config.js`**: Added `LEAGUE_SPLITS` and `LEAGUE_URL_MAPS` as browser globals so `no-undef` doesn't flag them.
- Lint passes with zero errors and zero warnings.

### Files Modified
- `league-splits.js`: **New file** — `LEAGUE_SPLITS` constant with dual-environment export.
- `league-urls.js`: **New file** — `LEAGUE_URL_MAPS` constant with dual-environment export.
- `MMM-SoccerStandings.js`: Removed inline constants; updated `getScripts()` and `getLeagueUrl()`.
- `eslint.config.js`: Added `LEAGUE_SPLITS`, `LEAGUE_URL_MAPS` to globals.

---

## [v3.0.2] - 2026-04-20 - Legacy Config Removal & Dead Code Cleanup

### Problem
- **Six `showXXX` config properties** (`showSPFL`, `showSPFLC`, `showEPL`, `showUCL`, `showUEL`, `showECL`) survived from before the `selectedLeagues` array was introduced. They were still in `defaults`, their associated `legacyLeagueToggle` switch still lived in `determineEnabledLeagues()`, and a full alternative button-generation code path still rendered the league selector using these stale properties.
- **Legacy button generation branch**: The `else` branch of the `autoGenerateButtons` block contained ~80 lines of button-creation code that read from the removed `showXXX` properties. It was unreachable in any normal configuration.
- **`migrateConfig()` in `european-leagues.js`**: A utility function that mapped old `showXXX` keys to `selectedLeagues` format. Exported via `module.exports` but never imported or called anywhere — pure dead code.
- **`cleanTeamName()` in `node_helper.js`**: A one-liner that stripped leading numbers and normalized whitespace. Defined but never called anywhere in the codebase.
- **Unused `error` variable in `GoogleParser.js`**: `catch (error)` with `error` never referenced — ESLint `no-unused-vars` error.
- **Spurious `eslint-disable` in `team-aliases.js`**: `/* eslint-disable no-unused-vars */` directive was no longer needed (ESLint reported it as unused).

### Solution
- **Removed legacy config properties from `defaults`**: Deleted `legacyLeagueToggle`, `showSPFL`, `showSPFLC`, `showEPL`, `showUCL`, `showUEL`, `showECL`. Also removed the stale `//firstPlaceColor` commented-out line (the actual feature still works via user config; just had no default).
- **Removed PRIORITY 2 block in `determineEnabledLeagues()`**: Deleted the `legacyLeagueToggle`-gated branch (~30 lines) that read from the now-removed properties.
- **Removed legacy button `else` branch**: Deleted the ~80-line alternative button-generation path that used `showXXX` config. When `autoGenerateButtons: false`, no buttons are rendered — the correct and documented behavior.
- **Removed `migrateConfig()`**: Deleted from `european-leagues.js` and removed from its `module.exports` list.
- **Removed `cleanTeamName()`**: Deleted from `node_helper.js`.
- **Fixed `GoogleParser.js`**: Changed `catch (error)` to `catch` (ES2019 optional catch binding) since the error is not used.
- **Fixed `team-aliases.js`**: Removed unnecessary `eslint-disable` directive.
- Lint passes with zero errors and zero warnings after all changes.

### Files Modified
- `MMM-SoccerStandings.js`: Removed legacy defaults block; removed PRIORITY 2 from `determineEnabledLeagues()`; removed legacy button `else` branch.
- `node_helper.js`: Removed `cleanTeamName()`.
- `european-leagues.js`: Removed `migrateConfig()` and its export entry.
- `GoogleParser.js`: `catch (error)` → `catch`.
- `team-aliases.js`: Removed unused `eslint-disable` directive.

---

## [v3.0.1] - 2026-04-20 - FontAwesome Fix, Config Defaults & Code Documentation

### Problem
- **FontAwesome icons not rendering**: `.league-meta-info` buttons use `<i>` elements with FA classes, but `font-awesome.css` was never declared as a module dependency. In MagicMirror² v2.34+ the vendor directory was removed; CSS must be declared in `getStyles()` using the MM alias string `"font-awesome.css"` or icons silently render as empty boxes.
- **`debug: true` in default config**: Module shipped with debug logging enabled by default, spamming `Log.info` on every user's installation regardless of whether they needed it.
- **`processLeagueData` SPFL hardcoded fallback**: Default `leagueType` fell back to `"SPFL"` when the incoming data had no `leagueType` field. Any league whose socket notification omitted `leagueType` was silently treated as a Scottish league.
- **Stale `node_helper.js` header comment**: Header JSDoc still described the module as "fetches SPFL league data from BBC Sport website", which was inaccurate since v2.3.0 when multi-provider support was added.
- **`normalizeTeamName` duplication undocumented**: `MMM-SoccerStandings.js::normalizeTeamName()` is an intentional copy of `logo-resolver.js::normalize()` for browser-runtime use, but this was not documented — future maintainers could not tell it was intentional vs. drift.

### Solution
- **FontAwesome dependency declared**: Added `"font-awesome.css"` as first entry in `getStyles()`. MagicMirror² maps this alias to `css/font-awesome.css` via `js/vendor.js`. Icons now render correctly.
- **`debug` default set to `false`**: Default config `debug: true` → `debug: false`. Users who need debug output must explicitly opt in.
- **`leagueType` fallback corrected**: `processLeagueData` now falls back to `data.league || "UNKNOWN"` instead of `"SPFL"`, preventing silent misclassification of non-Scottish leagues.
- **`node_helper.js` header updated**: JSDoc now reads "fetches soccer league standings from multiple providers (BBC Sport, ESPN, Soccerway, Wikipedia, Google)".
- **`normalizeTeamName` duplication documented**: Added comment above the frontend method explaining it is an intentional copy of the backend `normalize()` and why it cannot be shared (browser vs. Node.js runtime boundary). Also flags that both copies must be kept in sync.

### Files Modified
- `MMM-SoccerStandings.js`: `getStyles()` — added `"font-awesome.css"`; default config `debug` → `false`; `processLeagueData` leagueType fallback → `"UNKNOWN"`; `normalizeTeamName()` — added duplication rationale comment.
- `node_helper.js`: Header JSDoc updated to reflect multi-provider architecture.

---

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
