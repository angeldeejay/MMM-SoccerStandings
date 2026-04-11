# ESPN League Pages for MMM-MyTeams-LeagueTable

The module supports fetching league data from **ESPN**, providing a clean and reliable alternative for major and mid-tier global leagues.

**Caution:** Check that each URL remain valid prior to each new season starting.

🏆 - Denotes that the League splits mid season.

## How to Find ESPN URLs

ESPN standings pages use a simple URL structure. Follow these steps to find a league URL for your config:

1.  Visit [ESPN Soccer Standings](https://www.espn.com/soccer/standings).
2.  Select your desired league from the dropdown or navigation.
3.  Copy the URL from your browser's address bar. It should look like this:
    `https://www.espn.com/soccer/standings/_/league/rou.1` (Romania Liga I)
    `https://www.espn.com/soccer/standings/_/league/eng.1` (English Premier League)

## European Domestic Leagues - Tier 1

| Country | League Name | "parser" Website | showLeague |
|---------|-------------|------------|------------|
| Europe | UEFA Champions League | https://www.espn.com/soccer/standings/_/league/uefa.champions | UEFA_CHAMPIONS_LEAGUE |
| Europe | UEFA Europa League | https://www.espn.com/soccer/standings/_/league/uefa.europa | UEFA_EUROPA_LEAGUE |
| Europe | UEFA Europa Conference League | https://www.espn.com/soccer/standings/_/league/uefa.europa.conf | UEFA_EUROPA_CONFERENCE_LEAGUE |
| Scotland | Scottish Premiership 🏆 | https://www.espn.com/soccer/standings/_/league/sco.1 | SCOTLAND_PREMIERSHIP |
| Scotland | Scottish Championship | https://www.espn.com/soccer/standings/_/league/sco.2 | SCOTLAND_CHAMPIONSHIP |
| England | Premier League | https://www.espn.com/soccer/standings/_/league/eng.1 | ENGLAND_PREMIER_LEAGUE |
| England | Championship | https://www.espn.com/soccer/standings/_/league/eng.2 | ENGLAND_CHAMPIONSHIP |
| Germany | Bundesliga | https://www.espn.com/soccer/standings/_/league/ger.1 | GERMANY_BUNDESLIGA |
| France | Ligue 1 | https://www.espn.com/soccer/standings/_/league/fra.1 | FRANCE_LIGUE1 |
| Spain | La Liga | https://www.espn.com/soccer/standings/_/league/esp.1 | SPAIN_LA_LIGA |
| Italy | Serie A | https://www.espn.com/soccer/standings/_/league/ita.1 | ITALY_SERIE_A |
| Netherlands | Eredivisie | https://www.espn.com/soccer/standings/_/league/ned.1 | NETHERLANDS_EREDIVISIE |
| Belgium | Belgian Pro League 🏆 | https://www.espn.com/soccer/standings/_/league/bel.1 | BELGIUM_PRO_LEAGUE |
| Cyprus | Cypriot First Division 🏆 | https://www.espn.com/soccer/standings/_/league/cyp.1 | CYPRUS_FIRST_DIVISION |
| Portugal | Primeira Liga | https://www.espn.com/soccer/standings/_/league/por.1 | PORTUGAL_PRIMEIRA_LIGA |
| Turkey | Turkish Super Lig | https://www.espn.com/soccer/standings/_/league/tur.1 | TURKEY_SUPER_LIG |
| Greece | Greek Super League 🏆 | https://www.espn.com/soccer/standings/_/league/gre.1 | GREECE_SUPER_LEAGUE |
| Israel | Israeli Premier League 🏆 | https://www.espn.com/soccer/standings/_/league/isr.1 | ISRAEL_PREMIER_LEAGUE |
| Austria | Austrian Bundesliga 🏆 | https://www.espn.com/soccer/standings/_/league/aut.1 | AUSTRIA_BUNDESLIGA |
| Denmark | Superligaen 🏆 | https://www.espn.com/soccer/standings/_/league/den.1 | DENMARK_SUPERLIGAEN |
| Norway | Eliteserien | https://www.espn.com/soccer/standings/_/league/nor.1 | NORWAY_ELITESERIEN |
| Sweden | Allsvenskan | https://www.espn.com/soccer/standings/_/league/swe.1 | SWEDEN_ALLSVENSKAN |
| Switzerland | Swiss Super League 🏆 | https://www.espn.com/soccer/standings/_/league/sui.1 | SWITZERLAND_SUPER_LEAGUE |
| Romania | Liga I 🏆 | https://www.espn.com/soccer/standings/_/league/rou.1 | ROMANIA_LIGA_I |
| Northern Ireland | Irish Premiership | https://www.espn.com/soccer/standings/_/league/nir.1 | NI_PREMIERSHIP |
| Republic of Ireland | Irish Premier Division | https://www.espn.com/soccer/standings/_/league/irl.1 | IE_PREMIER_DIVISION |
| Wales | Cymru Premier 🏆 | https://www.espn.com/soccer/standings/_/league/wal.1 | WALES_PREMIER |
| Serbia | Serbian Super Liga 🏆 | https://www.espn.com/soccer/standings/_/league/srb.1 | SERBIA_SUPER_LIGA |


## European Domestic Leagues - Tier 2 

| Country | League Name | Wikipedia Website | showLeague |
|---------|-------------|------------|------------|
| USA | Major League Soccer | https://www.espn.com/soccer/standings/_/league/usa.1 | USA_MLS |
| Brazil | Brasileirão Serie A | https://www.espn.com/soccer/standings/_/league/bra.1 | BRAZIL_SERIE_A |
| Argentina | Primera División | https://www.espn.com/soccer/standings/_/league/arg.1 | ARGENTINA_PRIMERA |
| Mexico | Liga MX | https://www.espn.com/soccer/standings/_/league/mex.1 | MEXICO_LIGA_MX |
| Japan | J1 League | https://www.espn.com/soccer/standings/_/league/jpn.1 | JAPAN_J1_LEAGUE |
| Australia | A-League Men | https://www.espn.com/soccer/standings/_/league/aus.1 | AUSTRALIA_A_LEAGUE |
| China | Chinese Super League | https://www.espn.com/soccer/standings/_/league/chn.1 | CHIN
| Bolivia | Primera División | https://www.espn.com/soccer/standings/_/league/bol.1 | BOLIVIA_LIGA_1 |

## Other Non European Domestic Leagues 

| Country | League Name | Wikipedia Website | showLeague |
|---------|-------------|------------|------------|


## Using ESPN in your Config

To explicitly use ESPN for a specific league, set the `provider` config option to `"espn"`.

```javascript
{
    module: "MMM-MyTeams-LeagueTable",
    config: {
        provider: "espn",
        selectedLeagues: ["ENGLAND_PREMIER_LEAGUE"],
    }
}
```

## Why use ESPN?

- **Clean HTML**: ESPN's table structure is very consistent and easy to parse without JavaScript.
- **Global Coverage**: Coverage of most major and mid-tier professional leagues worldwide.
- **Reliability**: Structure changes are infrequent compared to other live sports sites.

## Troubleshooting

- **No Data Found**: Ensure you are on the **Standings** page. The URL must contain a table with stats like GP (Games Played) and PTS (Points).
- **Split Tables**: ESPN sometimes displays standings in two side-by-side tables (Team names on left, stats on right). The module's ESPN parser is designed to handle and join these automatically.
