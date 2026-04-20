# European Leagues Configuration Guide

## Overview

The **MMM-SoccerStandings** module now supports configurable selection of **any European nation's top-tier and second-tier men's professional football leagues**, plus UEFA competitions. Users can easily enable/disable specific leagues via configuration.

## Quick Start

### Method 1: New Configuration System (Recommended)

The recommended approach uses the `selectedLeagues` array to specify which leagues to display:

```javascript
{
  module: "MMM-SoccerStandings",
  position: "top_left",
  header: "Football Standings",
  config: {
    // ===== NEW: Use selectedLeagues array =====
    selectedLeagues: [
      "SCOTLAND_PREMIERSHIP",
      "GERMANY_BUNDESLIGA",
      "FRANCE_LIGUE1",
      "SPAIN_LA_LIGA",
      "ITALY_SERIE_A"
    ],
    
    // Display options (same as before)
    maxTeams: 20,
    showTeamLogos: true,
    showForm: true,
    autoCycle: true,
    cycleInterval: 15 * 1000
  }
}
```

**Why use this method?**
- ✅ Simple, declarative configuration
- ✅ Easy to add/remove leagues
- ✅ No legacy cruft
- ✅ Supports any number of leagues
- ✅ Future-proof

### Method 2: Legacy Configuration (Backward Compatible)

For existing configurations, the module still supports the old `showXXX` toggles:

```javascript
{
  module: "MMM-SoccerStandings",
  position: "top_left",
  config: {
    // Keep legacy mode enabled (default: true)
    legacyLeagueToggle: true,
    
    // Old configuration style still works
    showSPFL: true,
    showEPL: false,
    showUCL: true,
    showUEL: true,
    showECL: false
  }
}
```

**Note:** If you provide `selectedLeagues` with non-empty values, the legacy toggles are ignored.

---

## Available League Codes

### European Domestic Leagues - Tier 1

| Country | League Code | Display Name |
|---------|-------------|--------------|
| Austria | `AUSTRIA_BUNDESLIGA` | Austrian Bundesliga |
| Belgium | `BELGIUM_PRO_LEAGUE` | Belgian Pro League |
| Croatia | `CROATIA_HNL` | Croatian HNL |
| Czech Republic | `CZECH_LIGA` | Czech Liga |
| Denmark | `DENMARK_SUPERLIGAEN` | Superligaen |
| England | `ENGLAND_PREMIER_LEAGUE` | Premier League |
| France | `FRANCE_LIGUE1` | Ligue 1 |
| Germany | `GERMANY_BUNDESLIGA` | Bundesliga |
| Greece | `GREECE_SUPER_LEAGUE` | Greek Super League |
| Hungary | `HUNGARY_NBI` | Hungarian NB I |
| Italy | `ITALY_SERIE_A` | Serie A |
| Netherlands | `NETHERLANDS_EREDIVISIE` | Eredivisie |
| Northern Ireland | `NI_PREMIERSHIP` | Irish Premiership |
| Norway | `NORWAY_ELITESERIEN` | Eliteserien |
| Poland | `POLAND_EKSTRAKLASA` | Ekstraklasa |
| Portugal | `PORTUGAL_PRIMEIRA_LIGA` | Primeira Liga |
| Republic of Ireland | `IE_PREMIER_DIVISION` | Irish Premier Division |
| Romania | `ROMANIA_LIGA_I` | Romanian Super Liga |
| Russia | `showRPL` | Russian Premier League |
| Scotland | `SCOTLAND_PREMIERSHIP` | Scottish Premiership |
| Serbia | `SERBIA_SUPER_LIGA` | Serbian Super Liga |
| Spain | `SPAIN_LA_LIGA` | La Liga |
| Sweden | `SWEDEN_ALLSVENSKAN` | Allsvenskan |
| Switzerland | `SWITZERLAND_SUPER_LEAGUE` | Swiss Super League |
| Turkey | `TURKEY_SUPER_LIG` | Turkish Super Lig |
| Ukraine | `UKRAINE_PREMIER_LEAGUE` | Ukrainian Premier League |
| Wales | `WALES_PREMIER` | Cymru Premier |

### European Domestic Leagues - Tier 2

| Country | League Code | Display Name |
|---------|-------------|--------------|
| Austria | `showAustrian2Liga` | 2. Liga |
| Belgium | `showBelgianChallenger` | Challenger Pro League |
| Croatia | `showCroatiaFirstNL` | First NL |
| Czech Republic | `showCzechFNL` | National Football League |
| Denmark | `showDenmark1Div` | 1. Division |
| England | `ENGLAND_CHAMPIONSHIP` | Championship |
| France | `showLigue2` | Ligue 2 |
| Germany | `showBundesliga2` | 2. Bundesliga |
| Greece | `showGreekSuperLeague2` | Super League 2 |
| Hungary | `showHungaryNB2` | NB II |
| Italy | `showSerieB` | Serie B |
| Netherlands | `showEersteDivisie` | Eerste Divisie |
| Northern Ireland | `showNIChampionship` | NIFL Championship |
| Norway | `showNorway1Div` | 1. divisjon |
| Poland | `showPoland1Liga` | I liga |
| Portugal | `showLigaPortugal2` | Liga Portugal 2 |
| Republic of Ireland | `showIEFirstDivision` | First Division |
| Romania | `showRomaniaLiga2` | Liga II |
| Russia | `showRussianFirstLeague` | Russian First League |
| Scotland | `SCOTLAND_CHAMPIONSHIP` | Scottish Championship |
| Serbia | `showSerbiaFirstLeague` | Serbian First League |
| Spain | `showLaLiga2` | La Liga 2 |
| Sweden | `showSuperettan` | Superettan |
| Switzerland | `showSwissChallengeLeague` | Challenge League |
| Turkey | `showTFF1Lig` | TFF 1. Lig |
| Ukraine | `showUkrainianFirstLeague` | Ukrainian First League |
| Wales | `showWalesDiv1` | Cymru South/North |

### International & UEFA Competitions

| Competition | League Code |
|-------------|-------------|
| UEFA Champions League | `UEFA_CHAMPIONS_LEAGUE` |
| UEFA Europa League | `UEFA_EUROPA_LEAGUE` |
| UEFA Europa Conference League | `UEFA_EUROPA_CONFERENCE_LEAGUE` |
| FIFA World Cup 2026 | `WORLD_CUP_2026` |

---

## Configuration Examples

### Example 1: Top 5 European Leagues

Display the "Big Five" European football leagues:

```javascript
{
  module: "MMM-SoccerStandings",
  position: "top_left",
  header: "Top 5 European Leagues",
  config: {
    selectedLeagues: [
      "ENGLAND_PREMIER_LEAGUE",
      "SPAIN_LA_LIGA",
      "FRANCE_LIGUE1",
      "ITALY_SERIE_A",
      "GERMANY_BUNDESLIGA"
    ],
    autoCycle: true,
    cycleInterval: 20 * 1000,
    maxTeams: 10,
    showForm: true
  }
}
```

### Example 2: United Kingdom & Ireland

```javascript
{
  module: "MMM-SoccerStandings",
  config: {
    selectedLeagues: [
      "ENGLAND_PREMIER_LEAGUE",
      "SCOTLAND_PREMIERSHIP",
      "NI_PREMIERSHIP",
      "IE_PREMIER_DIVISION",
      "WALES_PREMIER"
    ]
  }
}
```

### Example 3: Mixed Domestic + European

Show specific leagues plus UEFA competitions:

```javascript
{
  module: "MMM-SoccerStandings",
  position: "top_left",
  header: "Football Standings",
  config: {
    selectedLeagues: [
      "SCOTLAND_PREMIERSHIP",
      "ENGLAND_PREMIER_LEAGUE",
      "UEFA_CHAMPIONS_LEAGUE",
      "UEFA_EUROPA_LEAGUE"
    ],
    autoCycle: true,
    cycleInterval: 12 * 1000,
    highlightTeams: ["Celtic", "Rangers", "Liverpool"]
  }
}
```

#### UEFA Competition Features
The module includes specialized logic for UEFA Champions League, Europa League, and Conference League:
- **Knockout Stage Navigation**: Automatically separates fixtures into "Playoff" (February) and "Rd16" (March) sub-tabs.
- **Off-Season Detection**: Automatically displays **"awaiting competition draw"** during the summer break (July to late August) when no live data is available.
- **Aggregate Scores**: Automatically displays aggregate totals for second-leg knockout matches.
- **Centered Layout**: Professional fixture presentation with team logos and centered scores.

---

## Migration from Legacy Config

### Before (Old Style)

```javascript
config: {
  showSPFL: true,
  showEPL: false,
  showUCL: true,
  showUEL: true,
  showECL: false
}
```

### After (New Style)

```javascript
config: {
  selectedLeagues: [
    "SCOTLAND_PREMIERSHIP",
    "UEFA_CHAMPIONS_LEAGUE",
    "UEFA_EUROPA_LEAGUE"
  ]
}
```

**The module automatically supports both formats**, so upgrading is optional. However, the new format is recommended for future-proofing.

---

## API Reference

### League Code Format

League codes follow the pattern:
```
COUNTRY_COMPETITION
```

Examples:
- `SCOTLAND_PREMIERSHIP` - Scottish Premiership
- `GERMANY_BUNDESLIGA` - German Bundesliga
- `FRANCE_LIGUE1` - French Ligue 1
- `UEFA_CHAMPIONS_LEAGUE` - UEFA Champions League

### Data Flow

1. **User Config** → `selectedLeagues: ["SCOTLAND_PREMIERSHIP", ...]`
2. **Module Initialization** → `determineEnabledLeagues()` parses config
3. **URL Resolution** → `getLeagueUrl()` maps codes to Source URLs
4. **Data Request** → `requestAllLeagueData()` fetches from Node Helper
5. **Parsing** → Node Helper parses HTML and returns standings
6. **Rendering** → Module displays standings with optional cycling
