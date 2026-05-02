# MMM-SoccerStandings

A **MagicMirror²** module for football standings and fixture views, powered by a local `espn-soccer-api` service.

- **Author**: ![Profile Image](https://avatars.githubusercontent.com/u/142350?s=16&v=4) [Andrés Vanegas <angeldeejay>](https://github.com/angeldeejay)

[![MagicMirror²](https://img.shields.io/badge/MagicMirror%C2%B2-v2.34.0+-blue.svg)](https://magicmirror.builders)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## What it does

- Standings render as position tables with configurable columns (played, W/D/L, GF/GA/GD, points, form).
- Fixture views render as scrollable card lists, not tabular bodies. Lists page vertically with marquee scrolling when they exceed `marqueePageSize`.
- Knockout fixtures show leg scores and aggregate totals for two-legged ties.
- Team logos come from provider payloads. If the provider returns no logo, the gap stays visible.
- League visibility is controlled only by `selectedLeagues`. Multiple leagues cycle automatically.

## Requirements

- **MagicMirror²** `v2.34.0+`
- **Node.js** `v24+`
- A running [`espn-soccer-api`](https://github.com/angeldeejay/espn-soccer-api) instance reachable at the configured `providerSettings.espn_service.baseUrl`

Without a reachable API the module renders an offline state and retries on a configurable back-off schedule.

## Installation

From your MagicMirror `modules/` directory:

```bash
git clone https://github.com/angeldeejay/MMM-SoccerStandings.git
cd MMM-SoccerStandings
node --run install
```

`node --run install` runs `scss:build` as a postinstall step. No separate CSS build is required.

## Update

```bash
cd ~/MagicMirror/modules/MMM-SoccerStandings
git pull
node --run install
```

## Configuration

Add the module to `~/MagicMirror/config/config.js`.

### Minimum configuration

```javascript
{
    module: "MMM-SoccerStandings",
    position: "top_right",
    config: {
        provider: "espn_service",
        providerSettings: {
            espn_service: { baseUrl: "http://localhost:28000" }
        },
        selectedLeagues: ["uefa.champions"]
    }
},
```

### Full annotated example

```javascript
{
    module: "MMM-SoccerStandings",
    position: "top_left",
    header: "League Standings",
    config: {
        // --- API connection ---
        provider: "espn_service",
        providerSettings: {
            espn_service: {
                baseUrl: "http://localhost:28000",
                timeoutMs: 8000
            }
        },

        // --- League selection ---
        selectedLeagues: ["uefa.champions", "col.1", "fifa.world"],

        // --- Data refresh ---
        updateInterval: 30 * 60 * 1000,
        retryDelay: 15000,
        maxRetries: 3,

        // --- Table columns ---
        showTeamLogos: true,
        showPlayedGames: true,
        showWon: true,
        showDrawn: true,
        showLost: true,
        showGoalsFor: true,
        showGoalsAgainst: true,
        showGoalDifference: true,
        showPoints: true,
        showForm: true,
        formMaxGames: 5,           // visible form tokens, clamped to 1..5
        enhancedIndicatorShapes: true,

        // --- Table display ---
        maxTeams: 12,
        highlightTeams: ["Celtic", "Hearts"],
        tableDensity: "normal",    // "compact" | "normal" | "comfortable"
        colored: true,

        // --- Fixture card scrolling ---
        marqueePageSize: 3,        // cards visible before marquee paging activates
        marqueePageInterval: 3,    // seconds per page

        // --- Cycling ---
        cycle: true,
        cycleInterval: 15 * 1000,

        // --- Appearance & cache ---
        theme: "auto",             // "auto" | "light" | "dark"
        darkMode: null,            // legacy override: null | true | false
        animationSpeed: 0,
        fadeSpeed: 0,
        clearCacheButton: true,
        clearCacheOnStart: false
    }
},
```

### Options reference

#### API connection

| Option             | Default          | Description                                          |
| :----------------- | :--------------- | :--------------------------------------------------- |
| `provider`         | `"espn_service"` | Active provider. Only `"espn_service"` is supported. |
| `providerSettings` | _(required)_     | Provider settings.                                   |

#### Provider Settings

##### ESPN Soccer API Provider

| Option      | Default      | Description                                                                     |
| :---------- | :----------- | :------------------------------------------------------------------------------ |
| `baseUrl`   | _(required)_ | Base URL of the `espn-soccer-api` instance. No default — fetch fails if absent. |
| `timeoutMs` | `8000`       | Request timeout in milliseconds.                                                |

---

#### League selection

| Option            | Default              | Description                                                                                                    |
| :---------------- | :------------------- | :------------------------------------------------------------------------------------------------------------- |
| `selectedLeagues` | `["uefa.champions"]` | Competition slugs to render, in display order. Accepted values: `"uefa.champions"`, `"col.1"`, `"fifa.world"`. |

#### Data refresh

| Option           | Default   | Description                                                                |
| :--------------- | :-------- | :------------------------------------------------------------------------- |
| `updateInterval` | `1800000` | Milliseconds between full data refreshes (default: 30 min).                |
| `retryDelay`     | `15000`   | Milliseconds to wait before retrying after a failed fetch.                 |
| `maxRetries`     | `3`       | Maximum consecutive retry attempts before the module enters offline state. |

#### Table columns

| Option                    | Default | Description                                                                                |
| :------------------------ | :------ | :----------------------------------------------------------------------------------------- |
| `showTeamLogos`           | `true`  | Show team logo images in the standings table.                                              |
| `showPlayedGames`         | `true`  | Show the played (P) column.                                                                |
| `showWon`                 | `true`  | Show the won (W) column.                                                                   |
| `showDrawn`               | `true`  | Show the drawn (D) column.                                                                 |
| `showLost`                | `true`  | Show the lost (L) column.                                                                  |
| `showGoalsFor`            | `true`  | Show the goals for (GF) column.                                                            |
| `showGoalsAgainst`        | `true`  | Show the goals against (GA) column.                                                        |
| `showGoalDifference`      | `true`  | Show the goal difference (GD) column.                                                      |
| `showPoints`              | `true`  | Show the points (Pts) column.                                                              |
| `showForm`                | `true`  | Show the recent-form token strip.                                                          |
| `formMaxGames`            | `5`     | Number of form tokens shown, clamped to 1–5.                                               |
| `enhancedIndicatorShapes` | `true`  | Use distinct shapes (circle/triangle/square) for W/D/L form tokens instead of colour only. |

#### Table display

| Option           | Default    | Description                                                            |
| :--------------- | :--------- | :--------------------------------------------------------------------- |
| `maxTeams`       | `12`       | Cap the number of rows shown per standings table. `0` shows all rows.  |
| `highlightTeams` | `[]`       | Team names to highlight in the table. Partial, case-insensitive match. |
| `tableDensity`   | `"normal"` | Row height preset: `"compact"`, `"normal"`, or `"comfortable"`.        |
| `colored`        | `true`     | Colour W/D/L and form tokens.                                          |

#### Fixture card scrolling

| Option                | Default | Description                                                                                               |
| :-------------------- | :------ | :-------------------------------------------------------------------------------------------------------- |
| `marqueePageSize`     | `3`     | Maximum number of fixture cards visible at once. Cards beyond this count trigger vertical marquee paging. |
| `marqueePageInterval` | `3`     | Seconds to display each page before scrolling to the next.                                                |

#### Cycling

| Option          | Default | Description                                                                                                                                      |
| :-------------- | :------ | :----------------------------------------------------------------------------------------------------------------------------------------------- |
| `cycle`         | `true`  | Automatically cycle through leagues and sub-tabs. Only explicit `false` disables cycling and removes the pin/countdown controls from the header. |
| `cycleInterval` | `15000` | Milliseconds between cycle steps.                                                                                                                |

#### Appearance and cache

| Option              | Default  | Description                                                                                               |
| :------------------ | :------- | :-------------------------------------------------------------------------------------------------------- |
| `theme`             | `"auto"` | Colour theme: `"auto"` (follows MagicMirror body class), `"light"`, or `"dark"`.                          |
| `darkMode`          | `null`   | Legacy dark-mode override. `null` defers to `theme`. `true`/`false` force the mode regardless of `theme`. |
| `animationSpeed`    | `0`      | DOM update animation speed in milliseconds.                                                               |
| `fadeSpeed`         | `0`      | League-switch fade speed in milliseconds.                                                                 |
| `clearCacheButton`  | `true`   | Show the clear-cache button in the module header.                                                         |
| `clearCacheOnStart` | `false`  | Flush the on-disk cache when the module initialises.                                                      |

### Multiple instances

Each module instance is independent. Use separate `position` values and separate `selectedLeagues` arrays:

```javascript
// Top-right: club competitions
{
    module: "MMM-SoccerStandings",
    position: "top_right",
    config: {
        provider: "espn_service",
        providerSettings: {
            espn_service: { baseUrl: "http://localhost:28000" }
        },
        selectedLeagues: ["uefa.champions"],
        cycle: false
    }
},
// Bottom-left: domestic + world cup
{
    module: "MMM-SoccerStandings",
    position: "bottom_left",
    config: {
        provider: "espn_service",
        providerSettings: {
            espn_service: { baseUrl: "http://localhost:28000" }
        },
        selectedLeagues: ["col.1", "fifa.world"]
    }
},
```

## Runtime notes

### Two-process architecture

The module runs across two execution environments that communicate via MagicMirror's socket notification system:

**Backend (`node_helper.js`)** — Node.js server process

- Handles `GET_COMPETITION_PAYLOAD` socket requests
- Fetches and normalises data through `backend/providers/espn-soccer-canonical-provider.js`
- Maintains a two-tier cache: in-memory `Map` + disk (`.cache/*.json`)

**Frontend (`MMM-SoccerStandings.js`)** — MagicMirror Electron browser

- Receives canonical payloads via socket notifications
- Renders standings tables using `DocumentFragment` for batched DOM updates (no `innerHTML`)
- Renders fixture cards with optional marquee paging
- Manages league tab switching, auto-cycling, pin/refresh controls, and touch interactions

### CSP and logos

Team logos are rendered with provider image URLs from the API response. If your deployment enforces a strict Content Security Policy, either allow the relevant image hosts or set `showTeamLogos: false`.

### Highlighted rows

Highlighted team rows use `rgba(255, 255, 255, 0.1)` background styling. This is intentional and not configurable via module options.

## Development commands

Run from the repository root:

```bash
node --run lint          # ESLint static analysis
node --run test              # Mocha domain-split test suite (35 tests across 6 files)
node --run scss:build    # Rebuild CSS from scss/entrypoint.scss
node --run format        # Prettier auto-format
node --run audit         # Check for dependency vulnerabilities
```

## Single-module sandbox

For live smoke checks, screenshots, and module-only debugging without a full MagicMirror checkout, use the mock API first:

```bash
# Terminal 1 — fixture-backed ESPN mock on localhost:3200
node --run mock-api:start

# Terminal 2 — sandbox (or :watch for hot-reload)
node --run sandbox:start
```

- Edit `config/module.config.json` to change the mounted module config and the API URL it consumes.
- Edit `config/runtime.config.json` to change the sandbox language and locale defaults.
- The sandbox mounts only `MMM-SoccerStandings` and only the MagicMirror surface this module uses.
- Set `providerSettings.espn_service.baseUrl` to `http://127.0.0.1:3200` in `config/module.config.json` to consume mock fixtures.

## Troubleshooting

**Module shows offline state**

- Verify `espn-soccer-api` is running: `curl http://localhost:28000/api/v1/leagues/`
- Check `providerSettings.espn_service.baseUrl` matches the running service address and port.

**No logos appear**

- The provider returned no logo URL for those teams. This is expected for some competitions.
- To suppress the gap entirely, set `showTeamLogos: false`.

**Aggregate scores not showing on knockout fixtures**

- Aggregate scores display only for second-leg fixtures (`leg_value === 2`) or after the series is complete (`series_completed === true`).
- Verify the `espn-soccer-api` version returns `leg_value` and `series_completed` fields.

**CSS looks wrong after an update**

- Run `node --run scss:build` to regenerate `MMM-SoccerStandings.css`.

## Repo references

| File / Path | Purpose                                                                                                                                     |
| :---------- | :------------------------------------------------------------------------------------------------------------------------------------------ |
| `README.md` | Setup and configuration guide (this file)                                                                                                   |
| `AGENTS.md` | Repository workflow and engineering rules                                                                                                   |
| `TODO.md`   | Operational notes and current findings                                                                                                      |
| `tests/`    | Domain-split test suite: `competition-keys`, `competition-catalog`, `canonical-payload`, `canonical-provider`, `view-model`, `module-shell` |
| `LICENSE`   | MIT license text                                                                                                                            |

## License

MIT
