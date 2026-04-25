# CHANGELOG

## [Unreleased] - 2026-04-20

### MVP wiring cleanup: competition routing now flows through shared helpers

**Problem:** Even after narrowing the MVP to UCL, `col.1`, and WC2026, the frontend still repeated the same competition-routing decisions in several places: default subtab selection, UEFA stage-aware landing, tournament view selection, and semantic World Cup checks. That repetition kept the runtime more monolithic than necessary.

**Fix:**
- Added shared helpers for competition-subtab routing, tournament-view detection, default subtab selection, and UEFA stage-aware subtab selection.
- Replaced repeated semantic `WORLD_CUP_2026` checks with helper-based checks where the code was really asking about competition type rather than a config key or ordering rule.
- Kept the cleanup inside MVP scope only, without widening coverage or changing the blocked UEFA expansion story.

**Files modified:** `MMM-SoccerStandings.js`, `TODO.md`, `CHANGELOG.md`

---

### League identifiers: active runtime no longer normalizes legacy shorthand league aliases

**Problem:** Even after shifting canonical gating to provider slugs, the frontend still accepted shorthand league aliases like `UCL`, `SPFL`, and `EPL` through runtime normalization and league metadata helpers. That kept a legacy compatibility layer alive in the exact area the rebuild is trying to simplify.

**Fix:**
- Removed live shorthand alias normalization from `normalizeLeagueCode()` so selected leagues now flow through canonical identifiers or provider slugs directly.
- Removed redundant alias-based UEFA overrides and abbreviation keys from league metadata helpers.
- Kept the runtime focused on canonical identifiers for the MVP path instead of silently translating older shorthand values.

**Files modified:** `MMM-SoccerStandings.js`, `CHANGELOG.md`

---

### MVP docs narrowing: README and config guide now describe the real rebuild scope

**Problem:** The top-level docs still described a much broader product than the one currently being rebuilt. README and configuration examples still centered leagues and examples outside the agreed MVP, which made the current implementation direction look wider than it really is.

**Fix:**
- Reframed README and the configuration guide around the active MVP scope: `UEFA_CHAMPIONS_LEAGUE`, `COLOMBIA_PRIMERA`, and `WORLD_CUP_2026`.
- Replaced out-of-scope examples with MVP-first examples, including UCL as the minimum config and a three-competition MVP rotation example.
- Clarified that broader league/provider coverage still exists only as legacy coverage rather than the primary rebuilt product surface.

**Files modified:** `README.md`, `documentation/Configuration_User_Guide.md`, `CHANGELOG.md`

---

### MVP scope tightening: UCL is now the default startup league

**Problem:** The rebuild goal was narrowed to an MVP centered on `COLOMBIA_PRIMERA`, `UEFA_CHAMPIONS_LEAGUE`, and `WORLD_CUP_2026`, but the module still defaulted and fell back to Scotland-era startup behavior. The canonical flat slice also still advertised Scotland and England as active rebuild targets.

**Fix:**
- Changed the default `selectedLeagues` startup from `SCOTLAND_PREMIERSHIP` to `UEFA_CHAMPIONS_LEAGUE`.
- Changed empty-league fallbacks so the module now lands on UCL instead of Scotland-era defaults.
- Narrowed the active canonical flat slice back to the MVP scope by keeping `COLOMBIA_PRIMERA` as the only flat-league canonical slice and leaving UCL as the hybrid table overlay path.
- Corrected canonical flat payload metadata so fixture-capable payloads no longer advertise `fixtures: false`.
- Reused provider `primary_logo` values from canonical fixtures to hydrate standings team logos without scraper-era mapping.

**Files modified:** `MMM-SoccerStandings.js`, `backend/slice1-flat-standings.js`, `README.md`, `documentation/Configuration_User_Guide.md`, `CHANGELOG.md`

---

### UEFA Champions League: canonical table overlay on top of legacy knockout data

**Problem:** UCL still depended fully on the legacy BBC path, even though the local `espn-soccer-api` service already exposes usable league-phase standings for `uefa.champions`. Moving all of UEFA at once would be too risky because knockout stage metadata still lives in the BBC parser shape.

**Fix:**
- Enabled a narrow canonical overlay for `UEFA_CHAMPIONS_LEAGUE` standings via `GET_COMPETITION_PAYLOAD`.
- Kept the legacy `GET_LEAGUE_DATA` request for UCL so knockout tabs and BBC-derived stage buckets still work.
- Merged canonical table rows onto the legacy UCL tournament data in `getRenderLeagueData()` so the `Table` tab can move toward the API-first path without breaking knockout surfaces.
- Live smoke validation confirmed UCL still renders with its existing tabs while the canonical UCL cache is now produced on load.

**Files modified:** `backend/slice1-flat-standings.js`, `MMM-SoccerStandings.js`, `CHANGELOG.md`

---

### UX cleanup: no fake BBC source fallback and no giant cycle countdowns

**Problem:** Two residual frontend defaults were producing misleading UI. Footer source text could still fall back to `BBC Sport` even when the current view had no explicit source, and long cycle intervals could render a noisy multi-thousand-second countdown in the header.

**Fix:**
- Replaced the hardcoded footer fallback with the existing translated `SOURCE_UNAVAILABLE` label.
- Suppressed the header countdown when the cycle interval is very large (`>= 1 hour`), keeping the header quiet instead of showing an unhelpful raw seconds counter.

**Files modified:** `MMM-SoccerStandings.js`, `CHANGELOG.md`

---

### Logging hardening: canonical and ESPN service backend paths now use module logging

**Problem:** The new API-first slices were already active, but the production backend/runtime path still used raw `console.*` calls across canonical fetches, the live `espn_service` flow, shared request plumbing, cache plumbing, and active parsers. That broke the repo's logging rules and made the rebuilt production path inconsistent with the rest of the module.

**Fix:**
- Added MagicMirror logger usage across active backend/runtime files.
- Replaced raw debug/error logging in canonical payload fetches, ESPN service fetches, shared request plumbing, cache plumbing, and active parsers with `Log.info()` / `Log.warn()` / `Log.error()`.
- Switched the currently used World Cup ESPN helper, legacy fetch orchestration in `node_helper.js`, and parser/base-parser logging to the same convention.
- Left `repro.js` alone because it is a standalone diagnostic script rather than module runtime code.

**Files modified:** `node_helper.js`, `shared-request-manager.js`, `cache-manager.js`, `logo-resolver.js`, `parsers/BaseParser.js`, `parsers/BBCParser.js`, `parsers/ESPNParser.js`, `parsers/FIFAParser.js`, `parsers/GoogleParser.js`, `parsers/SoccerwayParser.js`, `parsers/WikipediaParser.js`, `CHANGELOG.md`

---

### Rebuild Slice 3: canonical grouped World Cup path

**Problem:** `WORLD_CUP_2026` already had grouped provider data, but the rebuild path still stopped at flat competitions. That meant World Cup group tabs and grouped tables still depended on legacy payload shapes and direct `leagueData` assumptions instead of the canonical `COMPETITION_PAYLOAD` flow.

**Fix:**
- Extended the canonical competition backend so `GET_COMPETITION_PAYLOAD` now accepts grouped `WORLD_CUP_2026` requests in addition to flat leagues.
- Added grouped payload assembly in `backend/slice1-flat-standings.js`, reusing the existing ESPN service World Cup grouping logic to emit canonical group standings plus group fixtures/knockout buckets.
- Updated `node_helper.js` so grouped canonical payloads are emitted without forcing the flat legacy bridge.
- Updated `MMM-SoccerStandings.js` so World Cup can hydrate its current renderer from canonical grouped payloads and so the WC subtab rail reads from render data instead of only raw `leagueData`.
- Provider-backed smoke validation confirmed the canonical grouped payload now contains 12 groups plus knockout stages from live `fifa.world` data.

**Files modified:** `backend/slice1-flat-standings.js`, `node_helper.js`, `MMM-SoccerStandings.js`, `CHANGELOG.md`

---

### Flat leagues: Table / Fixtures subtabs and user-relevant fixture filtering

**Problem:** Even after windowing, flat leagues still mixed standings and fixtures in one surface. That wasted vertical space, made long domestic leagues feel cramped, and did not take advantage of `highlightTeams` to prioritize the fixtures the user actually cares about.

**Fix:**
- Added flat-league `Table` / `Fixtures` subtabs for the canonical flat slice.
- Made flat-league subtab cycling follow the existing cycle options instead of forcing a fixed combined layout.
- Kept `Table` focused on standings only and moved results/upcoming into the `Fixtures` tab.
- Reused `highlightTeams` so, when relevant teams are present, the fixtures pool narrows to those team matches before applying the nearby-window logic.
- Added optional `maxLeaguePastFixtures` and `maxLeagueUpcomingFixtures` caps so users can tighten flat-league fixture visibility beyond the automatic nearby-window logic.
- Live validation on Colombia Primera confirmed the `Fixtures` tab now shows a compact window and scheduled matches render kickoff times instead of fake `0-0` scores.

**Files modified:** `MMM-SoccerStandings.js`, `CHANGELOG.md`

---

### Flat leagues: fixture windows no longer dump the whole season

**Problem:** The first flat-league canonical fixtures render correctly separated results and upcoming matches, but it still passed every fixture in the season into those sections. In practice that made domestic leagues like Colombia Primera show an endless fixtures list instead of one useful nearby window.

**Fix:**
- Added flat-league fixture windowing in `MMM-SoccerStandings.js`.
- Recent results now collapse to the most recent nearby matchday block instead of the full historical season list.
- Upcoming fixtures now collapse to the nearest upcoming block instead of all future fixtures.
- Kept the windowing isolated to the flat canonical slice so UEFA and World Cup flows keep their own stage-specific behavior.

**Files modified:** `MMM-SoccerStandings.js`, `CHANGELOG.md`

---

### Rebuild Slice 2: canonical flat-fixtures path and provider-config cleanup

**Problem:** After slice 1, the module could render canonical flat standings, but fixtures for flat leagues still depended on legacy payload shapes and the old `espn_service` path still carried a hardcoded service base URL. That left two gaps: the next canonical slice was not landed yet, and the legacy service path could still fail by trying to reach an outdated host.

**Fix:**
- Extended `backend/slice1-flat-standings.js` so canonical payload assembly can also include fixtures.
- Normalized fixture mapping so non-started matches keep `score.home` / `score.away` as `null`, preventing fake `0-0` displays.
- Extended the temporary canonical-to-legacy bridge so canonical fixture payloads can still feed existing renderer expectations during the migration.
- Updated `node_helper.js` so both canonical and legacy `espn_service` flows resolve their base URL from `providerSettings.espn_service.baseUrl` instead of the old hardcoded host.
- Added the first flat-league fixtures UI path in `MMM-SoccerStandings.js`, reusing the same visual split pattern as UCL-without-subtabs: standings table plus results/upcoming sections beneath it.
- Added current project notes that slice 2 validation is waiting on a flat league in `espn-soccer-api` that actually returns fixture rows in this session.

**Why not fully closed yet:** live runtime validation for slice 2 is currently blocked by provider data availability. At validation time, `eng.1`, `sco.1`, and `col.1` returned zero fixture rows from the local `espn-soccer-api` service, so the implemented flat-fixtures path is present in code but not yet fully proven in the live module.

**Files modified:** `backend/slice1-flat-standings.js`, `node_helper.js`, `MMM-SoccerStandings.js`, `constants/league-urls.js`, `parsers/ESPNServiceParser.js`, `TODO.md`, `CHANGELOG.md`

---

### Rebuild Slice 1: first canonical flat-standings path

**Problem:** The rebuild had contracts, but startup and rendering still ran fully through scraper-era request and payload flows. Even leagues already available in the local `espn-soccer-api` service still entered the module as legacy provider-chain traffic, so there was no real production slice of the new architecture yet.

**Fix:**
- Added `backend/slice1-flat-standings.js` with the first canonical helpers for:
  - supported flat-table competitions
  - provider base URL resolution from config
  - canonical standings payload assembly
  - temporary canonical-to-legacy bridge payload generation
- Added `GET_COMPETITION_PAYLOAD` / `COMPETITION_PAYLOAD` handling in `node_helper.js` for the first canonical standings path.
- Added a frontend canonical request path and canonical payload ingestion in `MMM-SoccerStandings.js`.
- Added the first canonical render bridge so supported flat-table competitions can render from a canonical standings view-model while untouched surfaces still keep working.
- Enabled `SCOTLAND_PREMIERSHIP` in the local ESPN service league map so the default module config can enter the first slice immediately.

**Files modified:** `backend/slice1-flat-standings.js`, `node_helper.js`, `MMM-SoccerStandings.js`, `constants/league-urls.js`, `CHANGELOG.md`

---

### Rebuild Design: Vertical slices and legacy removal contracts

**Problem:** The rebuild already had canonical schema, provider, frontend-state, backend-gateway, and render contracts, but it still lacked a concrete end-to-end landing order and a safe deletion plan for scraper-era architecture. Without that, implementation risk stayed high: too easy to do a partial rewrite or to keep dead legacy branches around forever.

**Fix:**
- Added `contracts/vertical-slices.contract.yaml` to define the delivery order:
  - slice 1: flat standings
  - slice 2: flat fixtures
  - slice 3: grouped World Cup standings
  - slice 4: knockout fixtures
- Added `contracts/legacy-removal.contract.yaml` to define removal waves for provider chains, scraper parsers, legacy constants, frontend state branches, and outdated docs.
- Recorded the temporary compatibility bridge policy so new canonical backend/frontend work can land without a one-shot rewrite.

**Files modified:** `contracts/vertical-slices.contract.yaml`, `contracts/legacy-removal.contract.yaml`, `TODO.md`, `CHANGELOG.md`

---

### Refactor: ESPN provider switched to JSON API

**Problem:** ESPN is a client-side React SPA. Plain HTTP GET requests returned only the JS bundle
shell — no standings data. The HTML scraper in `ESPNParser.js` was effectively broken for all leagues.

**Fix:**
- `constants/league-urls.js` — All 30 ESPN URLs changed from `www.espn.com/soccer/standings/_/league/{id}`
  to `https://site.api.espn.com/apis/v2/sports/soccer/{id}/standings` (public, no auth required).
- `parsers/ESPNParser.js` — Rewritten to parse the ESPN API JSON response:
  - `_parseJson()` handles single-table (domestic leagues, UCL league phase) and multi-group
    (World Cup Groups A–L) layouts. Detects multiple `children[]` entries for group-based leagues.
  - `_parseEntry()` maps ESPN stats array (`gamesPlayed`, `wins`, `draws`, `losses`, `pointsFor`,
    `pointsAgainst`, `pointDifferential`, `points`, `rank`) to the module's team format.
  - Legacy HTML `_parseHtml()`, `_parseJoinedRows()`, `_parseTeamRow()` kept as internal fallback
    methods in case a stale HTML response is received. Also fixed potential crash on short stats arrays
    (`stats[6]` guard added).

**ESPN API league codes:** `eng.1`, `esp.1`, `ger.1`, `fra.1`, `ita.1`, `ned.1`, `por.1`, `bel.1`,
`sco.1`, `sco.2`, `eng.2`, `tur.1`, `gre.1`, `aut.1`, `den.1`, `nor.1`, `swe.1`, `sui.1`, `rou.1`,
`cro.1`, `srb.1`, `ukr.1`, `hun.1`, `pol.1`, `cze.1`, `wal.1`, `cyp.1`, `isr.1`,
`uefa.champions`, `fifa.world`

**Files modified:** `parsers/ESPNParser.js`, `constants/league-urls.js`

---

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
