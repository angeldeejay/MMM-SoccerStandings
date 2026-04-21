# CHANGELOG

## [Unreleased] - 2026-04-20

### Problems Fixed

**BBCParser — UCL/UEL/ECL fixture scores and aggregates broken by BBC HTML redesign**

BBC Sport changed their frontend from legacy CSS class names (`sp-c-fixture__number`, `ScoreValue`,
`sp-c-fixture--result`, etc.) to a React/CSS-in-JS structure where display class names are dynamic
hashes (`ssrcss-*`) but component-role tokens (`HomeScore`, `AwayScore`, `StyledPeriod`) remain
stable as class suffixes. None of the old class names survive; `data-testid` anchors are now the
stable hook.

Observed symptom: UCL Sporting vs Arsenal showed score "2026-4" and aggregate "6-04" instead of
the correct "0-0" and "Agg 1-0".

Root causes identified via live BBC HTML inspection (`2026-04?filter=results`):

1. **`ListItem` over-match** (`parsers/BBCParser.js:337`): The fixtureRegex class list included bare
   `ListItem`, which matched 28 `<li class="GlobalNavigationListItem">` elements from the BBC global
   nav. These were discarded later (no teams found) but polluted the match stream and triggered the
   `$`-boundary problem below.

2. **`$` boundary captures full page footer** (`parsers/BBCParser.js:337`): The lookahead regex used
   `$` as the terminal boundary. The _last_ `<div data-event-id>` block in each HTML part had no
   "next fixture" to stop at, so its content extended to end-of-string — including all navigation,
   footer, and canonical URL HTML. That footer contains `2026-04` in encoded URLs like
   `%2F2026-04%3Ffilter%3Dresults`. Step 4 fallback then matched `2026-04` as the score.

3. **Step 3 score extraction returns 1 candidate** (`parsers/BBCParser.js:562–572`): Step 3 matches
   `data-testid="score"` but captures the entire inner HTML (three child divs) as one string.
   Non-greedy `[\s\S]*?` closes on the _first_ inner `</div>`, returning only the `HomeScore` digit.
   After tag stripping `candidateScores` has 1 element — not ≥ 2 — so the step fails and falls
   through to step 4.

4. **Step 4 fallback too broad** (`parsers/BBCParser.js:576`): `(\d+)\s*[-–,]\s*(\d+)` matches any
   digit-hyphen-digit, including year-month fragments (`2026-04`) from URLs embedded in the block.

Fixes applied:

- **`ListItem` removed** from fixtureRegex match and lookahead patterns; `MatchListItem` retained.
- **`</ul>` and `</section>` added** as lookahead stop-boundaries so the last fixture block ends at
  the closing tag of the fixture list, not at end-of-string.
- **Step 1.5 added**: extracts scores from `HomeScore`/`AwayScore` class-suffix divs inside
  `data-testid="score"` — stable across CSS-in-JS hash regeneration.
- **P0 aggregate extraction**: `data-testid="agg-score"` text content read directly before falling
  back to the existing regex chain.
- **Step 4 restricted** to `(?<![0-9])(\d{1,2})\s*[-–]\s*(\d{1,2})(?![0-9])` — max 2-digit scores
  only, preventing year/month matches.

Files modified: `parsers/BBCParser.js` lines 337, 502–513, 539–549, 576–582.

**BBCParser — team name collision for teams with different mobile/desktop names**

BBC renders each team name as two separate `<span>` elements: `MobileValue` (short, e.g. "Atlético")
and `DesktopValue` (full, e.g. "Atletico Madrid"). Priority 5 team extraction collected ALL team name
spans in block order, deduplicating only on exact string match. For Atletico-Barcelona fixtures this
produced `["Atlético", "Atletico Madrid", "Barcelona"]` and assigned homeTeam="Atlético",
awayTeam="Atletico Madrid" — both referring to the same club. Barcelona was dropped.

Same problem affected "Paris SG" vs "Paris Saint-Germain" and any team whose mobile/desktop names differ.

Fix: inserted **Priority 4.5** before Priority 5 — extracts only `DesktopValue` spans in document
order (one per team, home before away). Result: `["Atletico Madrid", "Barcelona"]` → correct assignment.

Files modified: `parsers/BBCParser.js` (Priority 4.5 block added before Priority 5).

---

## [v3.0.0] - 2026-04-19 - Module Rename, Bug Fixes & Architecture Refactor

### Problems Fixed

**Critical / P0**

- **Module identity mismatch**: Directory renamed to `MMM-SoccerStandings` but `Module.register`, CSS file reference, and `package.json` still referenced old name `MMM-MyTeams-LeagueTable`, causing MagicMirror to silently fail loading the module.
- **Blank screen on league switch**: `_shouldSkipRender()` returned `true` during tab transitions due to stale render key comparison, causing `getDom()` to return an empty container.
- **FontAwesome icons not rendering**: `.league-meta-info` buttons use `<i>` elements with FA classes, but `font-awesome.css` was never declared as a module dependency. In MagicMirror² v2.34+ the vendor directory was removed; CSS must be declared in `getStyles()` using the MM alias string `"font-awesome.css"` or icons silently render as empty boxes.

**Data / Display Bugs**

- **Broken league selection**: Three independent bugs — `CYMRU_PREMIER_LEAGUE` key typo in `defaults.leagueHeaders`, `ENGLAND_PREMIER_LEAGUE` typo in `googleUrlMap`, and `NORTH MACEDONIA_FIRST_LEAGUE` key with a space in `european-leagues.js` — caused those leagues to fail URL resolution silently.
- **URL gap for EUROPEAN_LEAGUES-only leagues**: Leagues defined only in `european-leagues.js` (not in `bbcUrlMap`) had no URL resolved, preventing any fetch.
- **`form` field type mismatch**: `BaseParser._blankTeam()` returned `form: ""` (string) but all rendering code expected `form: []` (array), causing silent rendering failures for form badges.
- **`WORLD_CUP_2026` invisible by default**: `showWC2026: false` default meant the `=== false` guard always triggered, filtering WC2026 out of `enabledLeagueCodes` even when explicitly listed in `selectedLeagues`. Same bug affected `showUEFAleagues`.

**World Cup 2026**

- **WC 2026 always starting on Semifinals tab**: `_inferUEFAStage()` (designed for UEFA competition stage detection) was incorrectly applied to World Cup fixture articles. It converted `"Round of 32"` stage strings to `"Playoff"`, corrupting fixture grouping and causing the wrong tab to appear active on load.
- **Auto-cycle ignoring WC default sub-tab**: When auto-cycling landed on `WORLD_CUP_2026`, `currentSubTab` was not reset, so the sub-tab persisted from whatever the user had selected last.

**Config Noise**

- **`debug: true` in default config**: Module shipped with debug logging enabled by default, spamming `Log.info` on every user's installation regardless of whether they needed it.
- **`processLeagueData` SPFL hardcoded fallback**: Default `leagueType` fell back to `"SPFL"` when the incoming data had no `leagueType` field. Any league whose socket notification omitted `leagueType` was silently treated as a Scottish league.
- **Scroll options with no effect**: `scrollable`, `maxTableHeight`, `enableVirtualScrolling`, and `virtualScrollThreshold` were dead config — `scrollable` was never read in any conditional, `maxTableHeight` was assigned but immediately commented out, and virtual scrolling only makes sense when a user can scroll. Module is designed for display-only devices (monitors with no mouse/keyboard); table length is controlled exclusively by `maxTeams`.
- **Six legacy `showXXX` config properties** (`showSPFL`, `showSPFLC`, `showEPL`, `showUCL`, `showUEL`, `showECL`) survived from before `selectedLeagues` was introduced. Still in `defaults` with an associated `legacyLeagueToggle` switch in `determineEnabledLeagues()` and an ~80-line unreachable legacy button-generation branch.

**Architecture / Dead Code**

- **`LEAGUE_SPLITS` inside `Module.register`**: Split-league config was nested inside the module object, making it inaccessible outside the MagicMirror module scope.
- **`migrateConfig()` in `european-leagues.js`**: Mapped old `showXXX` keys to `selectedLeagues` format. Exported but never imported or called anywhere.
- **`cleanTeamName()` in `node_helper.js`**: One-liner utility. Defined but never called anywhere.
- **Duplicate team alias definitions**: The alias map was hardcoded identically in both `logo-resolver.js` (Node.js) and `MMM-SoccerStandings.js` (browser), requiring dual maintenance.
- **`~810` lines of inlined constants in `MMM-SoccerStandings.js`**: `LEAGUE_SPLITS` (~550 lines) and five provider URL maps (~260 lines) inlined in the main module file, shared with nothing.
- **Flat root directory**: 30+ files — constants, parsers, helpers, and module entry points all flat.
- **Stale documentation**: All 18 docs still referenced old module name `MMM-MyTeams-LeagueTable`; `bbcLeaguesPages.md` used old `showXXX` identifiers; README included removed legacy config options; `showWC2026`/`showUEFAleagues` defaults shown as `false` instead of `null`.

### Solution

**Module & Identity**

- Updated `Module.register("MMM-SoccerStandings")`, `getStyles()` CSS reference, `package.json` name/main/scripts, and all log prefix strings in `node_helper.js`.
- Added `"font-awesome.css"` as first entry in `getStyles()`.

**Bug Fixes**

- Removed `_shouldSkipRender()` and all `_lastRenderedKey` references. `getDom()` always renders current data.
- Fixed league key typos: `CYMRU_PREMIER_LEAGUE` in `defaults.leagueHeaders`, `ENGLAND_PREMIER_LEAGUE` in `googleUrlMap`, `NORTH_MACEDONIA_FIRST_LEAGUE` in `european-leagues.js`; removed duplicate `SERBIA_SUPER_LIGA`.
- `getLeagueUrl()` now checks `EUROPEAN_LEAGUES[leagueCode].url` as fallback when `bbcUrlMap` has no entry.
- `BaseParser._blankTeam()` now returns `form: []`.
- `showWC2026` default → `null`; `showUEFAleagues` default → `null`. Strict `=== false` check now only fires on explicit user opt-out.
- Added `skipStageInference` parameter to `BBCParser._parseBBCFixtureArticles()`. `FIFAParser` passes `true`, preventing `_inferUEFAStage()` from corrupting WC stage strings.
- `cycleFn` resets `currentSubTab` to `config.defaultWCSubTab || "A"` when cycling to `WORLD_CUP_2026`.
- `debug` default `true` → `false`. `processLeagueData` leagueType fallback → `"UNKNOWN"` (was `"SPFL"`).

**Config & Dead Code Removal**

- Removed `scrollable`, `maxTableHeight`, `enableVirtualScrolling`, `virtualScrollThreshold` from defaults.
- Removed virtual scroll JS: `_totalTeamsRendered` counter, `if (enableVirtualScrolling)` block, `maximized-section` class assignment.
- Removed `legacyLeagueToggle`, `showSPFL`, `showSPFLC`, `showEPL`, `showUCL`, `showUEL`, `showECL` from defaults; removed PRIORITY 2 block in `determineEnabledLeagues()`; removed legacy button `else` branch (~80 lines).
- Removed `migrateConfig()` from `european-leagues.js`; removed `cleanTeamName()` from `node_helper.js`.
- Fixed `GoogleParser.js`: `catch (error)` → `catch` (ES2019 optional catch binding). Removed unnecessary `eslint-disable` from `team-aliases.js`.

**CSS / SCSS**

- All scroll overflow constraints removed: `.league-body-scroll`, `.fixtures-body-scroll`, `.uefa-section-scroll` set to `overflow-y: hidden`. `.fixtures-wrapper-v2` `max-height: 490px` removed. `.uefa-section-wrapper` fixed `height: 300px/600px` → `height: auto`. `.uefa-split-view-container` `min-height`/`max-height` removed.
- Removed `PERF-03: VIRTUAL SCROLLING SUPPORT` SCSS section (`.virtual-scroll-container`, `.virtual-scroll-spacer`, `.virtual-scroll-viewport`, `.virtual-scrolling-enabled .team-row`).
- Removed `--mtlt-max-table-height` CSS variable from `_abstracts.scss`.
- Removed dead CSS: `.scroll-btn-container`, `.scroll-nav-btn`, webkit scrollbar rules on `.fixtures-body-scroll`, `maximized-section`/`dual-sections`/`only-results`/`only-upcoming` height overrides.

**Architecture**

- **`LEAGUE_SPLITS` to module scope**: Moved before `Module.register()` so it is accessible globally.
- **`team-aliases.js`** (new): Shared team alias map with dual-environment export. `logo-resolver.js` `require()`s it; frontend loads via `getScripts()`.
- **`league-splits.js`** (new): Extracts `LEAGUE_SPLITS` constant. Dual-environment export.
- **`league-urls.js`** (new): Extracts all five provider URL maps into `LEAGUE_URL_MAPS`. `getLeagueUrl()` destructures from it.
- **`constants/`** directory: `european-leagues.js`, `team-aliases.js`, `league-splits.js`, `league-urls.js`, `team-logo-mappings.js` moved here.
- **`parsers/`** directory: `BaseParser.js`, `BBCParser.js`, `ESPNParser.js`, `FIFAParser.js`, `GoogleParser.js`, `SoccerwayParser.js`, `WikipediaParser.js` moved here.
- Updated all `require()` paths in `node_helper.js` and `logo-resolver.js`; updated `getScripts()` paths in `MMM-SoccerStandings.js`.
- `package.json` lint/format scripts extended to cover `parsers/*.js` and `constants/*.js`.
- Added `LEAGUE_SPLITS` and `LEAGUE_URL_MAPS` as browser globals in `eslint.config.js`.

**Documentation**

- All 18 documentation files: `MMM-MyTeams-LeagueTable` → `MMM-SoccerStandings`.
- `README.md`: Removed legacy config block (Method 2, `legacyLeagueToggle`, `showXXX`); removed `scrollable`, `maxTableHeight`, `enableVirtualScrolling`, `virtualScrollThreshold` rows; updated `showWC2026`/`showUEFAleagues` defaults and descriptions to reflect three-state semantics (`null`/`true`/`false`).
- `documentation/Configuration_User_Guide.md`: Same removals and updates.
- `documentation/WorldCup2026-UserGuide.md`: Replaced `showWC2026: true` + `legacyLeagueToggle` with `selectedLeagues: ["WORLD_CUP_2026"]` as canonical approach.
- `documentation/bbcLeaguesPages.md`: Column header `showLeague` → `League Code`; all `showXXX` identifiers replaced with proper `selectedLeagues` league codes.

### Files Modified

- `MMM-SoccerStandings.js` (renamed from `MMM-MyTeams-LeagueTable.js`)
- `node_helper.js`
- `BBCParser.js` → `parsers/BBCParser.js`
- `FIFAParser.js` → `parsers/FIFAParser.js`
- `BaseParser.js` → `parsers/BaseParser.js`
- `ESPNParser.js`, `GoogleParser.js`, `SoccerwayParser.js`, `WikipediaParser.js` → `parsers/`
- `european-leagues.js` → `constants/european-leagues.js`
- `team-logo-mappings.js` → `constants/team-logo-mappings.js`
- `logo-resolver.js`
- `package.json`
- `eslint.config.js`
- `scss/_fixtures-and-wc.scss`, `scss/_advanced.scss`, `scss/_abstracts.scss`
- `MMM-SoccerStandings.css` (rebuilt from SCSS)
- `README.md`, all `documentation/*.md`
- **New files**: `constants/team-aliases.js`, `constants/league-splits.js`, `constants/league-urls.js`

---

## Earlier Versions

Refer to base repository [CHANGELOG.md](https://github.com/gitgitaway/MMM-MyTeams-LeagueTable/blob/main/CHANGELOG.md)
