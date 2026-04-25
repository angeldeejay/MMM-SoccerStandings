# MMM-SoccerStandings

A **MagicMirror²** module for football standings and fixture views.

The active product path is **API-first** and currently targets the local `espn-soccer-api` service through `provider: "espn_service"`.

Inspired by [MMM-MMM-MyTeams-LeagueTable](https://github.com/gitgitaway/MMM-MMM-MyTeams-LeagueTable).

- **Author**: ![Profile Image](https://avatars.githubusercontent.com/u/142350?s=16&v=4) [Andrés Vanegas <angeldeejay>](https://github.com/angeldeejay)

[![MagicMirror²](https://img.shields.io/badge/MagicMirror%C2%B2-v2.1.0+-blue.svg)](https://magicmirror.builders)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Current product scope

The active runtime is intentionally narrowed to these competition slugs:

- `uefa.champions`
- `col.1`
- `fifa.world`

Current behavior:

- Canonical payloads come from the backend provider path, not from scraping.
- UEFA Champions League and FIFA World Cup use tournament-oriented views.
- Colombian Primera A uses the flat league standings/fixtures path.
- Fixture views render as scrollable card lists, not tabular fixture bodies.
- Visible fixture lists page vertically with marquee scrolling when they exceed `marqueePageSize`.
- Team logos come from provider payloads. If the provider does not return a logo, the gap stays visible.
- League visibility is controlled only by `selectedLeagues`.

## Requirements

- **MagicMirror²** `v2.1.0+`
- **Node.js** `v14+`
- A reachable local `espn-soccer-api` instance, usually at `http://localhost:28000`

## Installation

From your MagicMirror modules directory:

```bash
git clone https://github.com/angeldeejay/MMM-SoccerStandings.git
cd MMM-SoccerStandings
npm install
npm run scss:build
```

## Update

```bash
cd ~/MagicMirror/modules/MMM-SoccerStandings
git pull
npm install
npm run scss:build
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
		selectedLeagues: ["uefa.champions"]
	}
},
```

### Expanded example

```javascript
{
	module: "MMM-SoccerStandings",
	position: "top_left",
	header: "League Standings",
	config: {
		provider: "espn_service",
		espnSoccerApiBaseUrl: "http://localhost:28000",
		espnSoccerApiTimeout: 8000,
		providerSettings: {
			espn_service: {
				baseUrl: "http://localhost:28000",
				timeoutMs: 8000
			}
		},
		selectedLeagues: ["uefa.champions", "col.1", "fifa.world"],
		updateInterval: 30 * 60 * 1000,
		retryDelay: 15000,
		maxRetries: 3,
		animationSpeed: 0,
		fadeSpeed: 0,
		colored: true,
		maxTeams: 12,
		highlightTeams: ["Celtic", "Hearts"],
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
		formMaxGames: 5, // visible form tokens (clamped to 1..5)
		enhancedIndicatorShapes: true,
		tableDensity: "normal",
		marqueePageSize: 3,
		marqueePageInterval: 3,
		theme: "auto",
		cycle: true,
		cycleInterval: 15 * 1000,
		darkMode: null,
		clearCacheButton: true,
		clearCacheOnStart: false
	}
},
```

### Common options

| Option                                    | Default                    | Description                                                                                                                    |
| :---------------------------------------- | :------------------------- | :----------------------------------------------------------------------------------------------------------------------------- |
| `provider`                                | `"espn_service"`           | Active provider for the current runtime.                                                                                       |
| `espnSoccerApiBaseUrl`                    | `"http://localhost:28000"` | Preferred base URL for the API consumed by canonical requests.                                                                 |
| `espnSoccerApiTimeout`                    | `8000`                     | Preferred request timeout for canonical requests.                                                                              |
| `providerSettings.espn_service.baseUrl`   | `"http://localhost:28000"` | Compatibility fallback for older config shapes.                                                                                |
| `providerSettings.espn_service.timeoutMs` | `8000`                     | Compatibility fallback for older config shapes.                                                                                |
| `selectedLeagues`                         | `["uefa.champions"]`       | Competition slugs to render. Use provider/API slugs directly.                                                                  |
| `tableDensity`                            | `"normal"`                 | `compact`, `normal`, or `comfortable`.                                                                                         |
| `marqueePageSize`                         | `3`                        | Maximum number of fixture cards visible before vertical marquee paging is enabled.                                             |
| `marqueePageInterval`                     | `3`                        | Seconds to wait on each visible fixture marquee page before smooth scrolling to the next page.                                 |
| `theme`                                   | `"auto"`                   | `auto`, `light`, or `dark`.                                                                                                    |
| `darkMode`                                | `null`                     | Legacy force override: `null`, `true`, or `false`.                                                                             |
| `cycle`                                   | `true`                     | Enables cycling by default. Only explicit `false` disables cycling and removes the pin/countdown controls from the header DOM. |
| `cycleInterval`                           | `15000`                    | Interval in milliseconds for each cycle step.                                                                                  |
| `clearCacheButton`                        | `true`                     | Show the clear-cache control in the UI.                                                                                        |
| `clearCacheOnStart`                       | `false`                    | Clear caches during startup.                                                                                                   |

## Runtime notes

- `node_helper.js` performs provider I/O server-side for the canonical data path.
- The frontend still renders team logos with provider image URLs. If your deployment enforces a strict CSP, allow the relevant image hosts or disable logos with `showTeamLogos: false`.
- Standings always render the position column, fixture recency always uses the real current date, and highlighted rows use the built-in `rgba(255, 255, 255, 0.1)` styling.
- This repo is a MagicMirror module, not a standalone web app.

## Development commands

Run from the repository root:

```bash
npm run lint
npm test
npm run scss:build
npm run format
```

## Single-module sandbox

For live smoke checks, screenshots, and module-only debugging without a full MagicMirror checkout:

```bash
npm run sandbox:start
npm run sandbox:watch
npm run mock-api:start
```

- `npm run sandbox:start` and `npm run sandbox:watch` launch the single-module sandbox provided by the installed `magicmirror-module-sandbox` package.
- Edit root `config\module.config.json` to change the mounted module config and the API URL it consumes.
- Root `config\runtime.config.json` holds the sandbox language/locale defaults.
- The packaged sandbox runtime is intentionally narrow: it mounts only `MMM-SoccerStandings` and only the MagicMirror surface this module actually uses.
- The fixture-backed ESPN mock now lives as a separate tool. Start it with `npm run mock-api:start`, then point `espnSoccerApiBaseUrl` at `http://127.0.0.1:3200`.

## Maintained repo references

- `README.md`: setup and configuration guide
- `AGENTS.md`: repository workflow and engineering rules
- `TODO.md`: operational notes and current findings
- `tests/`: domain-split canonical/provider/helper coverage (`competition-keys`, `competition-catalog`, `canonical-payload`, `canonical-provider`, `view-model`, `module-shell`)
- `LICENSE`: MIT license text

## License

MIT
