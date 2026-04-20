# Data Provider Factory Strategy

The **MMM-SoccerStandings** module uses a **Provider Factory** pattern to fetch and parse football league data from multiple sources. This ensures resilience and expands coverage to leagues not found on the BBC Sport website (e.g., Romania Liga 1 "SuperLiga").

## How It Works

1.  **Configuration**: Users can set the `provider` field in the module configuration.
2.  **Selection**: The `node_helper.js` selects the appropriate parser (`BBCParser`, `GoogleParser`, `SoccerwayParser`, `ESPNParser`, or `WikipediaParser`) based on the requested provider or by automatically detecting it from the URL.
3.  **Fallback Logic**: If the primary fetch or parse operation fails, the module automatically attempts to fetch from a fallback URL (if available).
4.  **Source Attribution**: Every table displayed in the module footer explicitly shows the source of the data (e.g., "Source: BBC Sport" or "Source: Google Search").

## Supported Providers

| Provider | Config Value | Pros | Cons |
| :--- | :--- | :--- | :--- |
| **Auto-Detect**| `"auto"` | Automatically selects the parser based on the domain of the URL provided. | Requires at least one valid URL to start. |
| **BBC Sport** | `"bbc"` | Highly reliable for major UK and European leagues. Resilient HTML structure. | Limited coverage of niche, lower, or non-UK/European leagues. |
| **Wikipedia** | `"wikipedia"` | Best fallback for niche leagues. Uses static HTML `wikitable` which is highly reliable for scraping. | Data may sometimes be updated slower than live sports sites. No match fixtures. |
| **Google Search** | `"google"` | Extremely resilient fallback for almost any league. Extracts data from Google's "sports snippets". | Limited details (often no full form history). |
| **ESPN** | `"espn"` | Excellent for major and mid-tier global leagues. Very clean and consistent HTML. | Coverage can be limited for lower-tier or amateur leagues. |
| **Soccerway** | `"soccerway"` | Industry-standard coverage of almost every professional league globally. | Modern site uses JavaScript heavily; scraping reliability is lower than Wikipedia. |
| **FIFA.com** | `"fifa"` | Official source for World Cup and FIFA-sanctioned international competitions. | Structure can be complex and specific to major tournaments. |


## Configuration Options

Add the following to your `config.js`:

```javascript
{
    module: "MMM-SoccerStandings",
    config: {
        provider: "auto", // Options: "auto", "bbc", "google", "wikipedia", "soccerway", "espn"
        selectedLeagues: ["SCOTLAND_PREMIERSHIP", "ROMANIA_LIGA_I", "BOLIVIA_LIGA_2"],
    }
}
```

## Resilience & Fallback

The module is designed to be "fail-safe":
- **Cache First**: It immediately shows cached data while fetching fresh data.
- **Multi-Provider Fallback**: If BBC Sport fails, the module will try Wikipedia (most reliable static HTML), or Google Search (highly available snippet data).
- **Split-League Awareness**: For leagues that split into groups (e.g., Romania, Scotland, Greece, Cyprus, etc) , the module detects if a provider is only returning a single group (like the Championship table). It will automatically escalate to the next provider (usually Wikipedia) to fetch the full multi-group standings.
- **Visual Feedback**: If data is outdated or from a fallback source, the footer will reflect the source and timestamp clearly.
- **Cache Validation**: Cached data for split leagues must contain all groups to be considered valid; otherwise, the module force-refreshes from a live source.
