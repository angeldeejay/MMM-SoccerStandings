# How This Module Works

The **MMM-SoccerStandings** is a comprehensive football data module for MagicMirror². It uses a distributed architecture to provide live updates while remaining efficient on low-power devices.

## 1. Architecture: The Backend (node_helper.js)
The core logic resides in the `node_helper.js`. This is the "brain" of the module that runs on your MagicMirror server (e.g., Raspberry Pi).

*   **Fetching**: The module uses a **Shared Request Manager** to fetch HTML from BBC Sport and FIFA. It includes "jitter" and rate-limiting to comply with fair-use policies and avoid being blocked.
*   **Parsing**: Instead of relying on expensive APIs, it uses specialized parsers (`BBCParser.js`, `FIFAParser.js`) to extract league standings, fixtures, and results directly from website HTML using high-performance regular expressions.
*   **Logo Resolution**: Over 1,700 team logos are managed on the backend. When data is parsed, the helper automatically attaches the correct local image path for each team, saving your browser from doing thousands of string lookups.
*   **World Cup Engine**: A dynamic resolution engine converts tournament placeholders (like "Winner Group A") into real team names as results come in.

## 2. Multi-Source Parsing Engine
The module uses a **Provider Factory** pattern to select the most appropriate parser based on the data source. Each parser uses unique heuristics to navigate different website structures:

### A. BBC Sport Parser (`BBCParser.js`)
*   **Heuristics**: Primarily looks for `<table>` elements and validates them by checking for headers like "Team", "Played", and "Points".
*   **Modern Layout Support**: If no tables are found, it switches to a secondary strategy that targets ARIA-labeled `role="row"` elements within `<div>` or `<article>` tags.
*   **UEFA Group Detection**: Uses a 300-character backward-looking buffer from the table to identify nearby "Group A" headers for Champions League and similar tournaments.
*   **Fixture Logic**: Implements a complex header-based splitting system to separate fixtures by date and competition stage.

### B. ESPN Parser (`ESPNParser.js`)
*   **Split-Table Strategy**: ESPN often uses a "dual-table" approach (one for team names, one for stats). The parser identifies these by the `Table--fixed` and `Table--ls` classes and joins them by row index.
*   **Single-Table Fallback**: If the dual-table layout is missing, it searches for any table containing "GP" (Games Played) and "PTS" (Points) headers.
*   **Heuristics**: Uses specific class names like `TeamLink` and `hide-mobile` to locate team names within rows.

### C. Soccerway Parser (`SoccerwayParser.js`)
*   **Class-Targeted Parsing**: Focuses on tables with the `leaguetable` class.
*   **Statistical Heuristics**: Uses a specialized `_extractStat` method that looks for cells with classes like `number mp` (matches played), `number won`, etc.
*   **Row Filtering**: Explicitly skips `<thead>` and `<th>` blocks to ensure only data rows are processed.

### D. Wikipedia Parser (`WikipediaParser.js`)
*   **"Best Table" Heuristic**: Wikipedia pages often have multiple tables. The parser calculates the row count of every `wikitable` and selects the largest one that contains "Team" or "Pos" keywords.
*   **Multi-Group Support**: For leagues with mid-season splits (e.g., Romania, Scotland, Austria, etc.), the parser uses a robust multi-strategy approach to extract ALL group tables (Championship, Relegation, etc.) simultaneously.
*   **Heading Keyword Match**: Scans each table's nearest preceding heading for specific keywords (e.g., "Championship round", "Play-off Group", "Bottom Six").
*   **Size-Based Fallback**: If headings are missing or non-standard, it uses a size-based match (within ±2 tolerance) based on the league's defined split group sizes.
*   **Deduplication**: Uses a `usedIndices` tracking system to ensure each table is only claimed by one group, preventing data duplication.
*   **Stat Normalization**: Wikipedia uses a non-standard minus character (`−`, U+2212) for goal difference. The parser normalizes this to a standard hyphen before numeric conversion.
*   **Identity Extraction**: Prioritizes `<a>` tag `title` attributes for team names to avoid superscript citation numbers (e.g., "[1]") often found in plain text cells.

### E. Google Search Parser (`GoogleParser.js`)
*   **Snippet-Targeted Parsing**: Optimized for Google's "sports snippets" which often appear at the top of search results.
*   **Resilient Heuristics**: Uses a multi-pass approach to identify standard table structures (P, W, D, L, GD, Pts) even when class names are obfuscated or dynamic.
*   **Safe Data Extraction**: Prioritizes `aria-label` and `title` attributes for team names to ensure accuracy and accessibility compliance.
*   **Dynamic Column Mapping**: Automatically detects and maps columns based on header content, ensuring compatibility with varying Google layout updates.

## 3. League Split System
To handle the complexity of European leagues that split into Championship and Relegation groups mid-season, the module implements a robust **Split Configuration** system:

*   **Split Configuration**: The `LEAGUE_SPLITS` constant in `MMM-SoccerStandings.js` defines the mechanics for leagues like the Romanian Liga I, Scottish Premiership, Austrian Bundesliga, Belgian Pro League, Greece Super League, Cyprus First Division, and Israel Premier League. This includes regular season game counts, group sizes, and point carryover rules.
*   **Awaiting Split Resilience**: A specialized state detection system handles the "limbo" period when the first phase of a split-season league has finished but the split groups haven't been officially announced. The module prevents 404 errors by detecting the completed game count and displaying a **⏳ AWAITING SPLIT** badge in the header.
*   **Multi-Group Rendering**: When a split is detected, the module creates a `splitGroups` data structure that allows the frontend to render multiple tables simultaneously.
*   **Labeled Separators**: The UI inserts centered, uppercase separator rows between groups to clearly label the "Championship Group", "Relegation Group", etc.
*   **Group-Aware Coloring**: Promotion and relegation zone coloring is applied independently within each group (e.g., the top 2 teams in the Championship group get promotion colors, while the bottom 2 teams in the Relegation group get relegation colors).
*   **Smart Escalation**: If the primary provider (e.g., BBC Sport) returns only the Championship group (a common occurrence post-split), the module automatically detects the missing data and escalates to Wikipedia to fetch the complete multi-group standings.
*   **Cache Integrity**: The `isDataComplete` logic ensures that if a league is configured for multiple groups, cached data without the `splitGroups` structure is rejected as stale, forcing a fresh fetch for the complete post-split view.

## 4. Smart Caching System
To ensure speed and reliability, the module implements a multi-tier caching strategy:
*   **Memory Cache**: Data is stored in RAM for near-instant access during league switching.
*   **Disk Persistence**: Data is saved to the `.cache/` folder. If your mirror restarts or loses internet, it can load the last known standings immediately.
*   **Proactive Caching**: When you switch leagues, the module serves the cached version *first* so you see data instantly, then fetches a live update in the background.
*   **Stale Fallback**: If a live update fails, the module continues to display the cached data but adds a "STALE" indicator to the header.

## 4. Architecture: The Frontend (MMM-SoccerStandings.js)
The frontend is responsible for the visual presentation and user interaction.

*   **DOM Batching**: It uses `DocumentFragment` to update the screen in one go, preventing flickering and reducing CPU usage.
*   **Horizontal Navigation**: A thin, styled scrollbar and directional arrow indicators enable effortless navigation when more leagues are selected than can fit in the header.
*   **Enhanced Header Interaction**: Redesigned, high-contrast buttons for Refresh, Clear Cache, and Pin, with active state and thumbtack tilt animations.
*   **Responsive UI**: The layout adapts to your mirror's size using CSS `clamp()` for fluid typography and flexible containers.
*   **Interactivity**: The module supports touch and mouse interaction for switching leagues, viewing fixtures, and manual refreshing.
*   **Auto-Cycling**: If configured, the module automatically rotates through your selected leagues at a set interval.

## 5. Logo Mapping Logic
Team crests are resolved using a multi-step process:
1.  **Direct Map**: Check the pre-defined `team-logo-mappings.js`.
2.  **Normalized Match**: Case-insensitive matching (e.g., "St Mirren" matches "st-mirren.png").
3.  **Diacritic Removal**: Handles accented characters (e.g., "Bodø" matches "bodo").
4.  **Alphanumeric Stripping**: Removes special characters to find the best match.

## 6. Security & Stability
*   **Sanitization**: All dynamic data is sanitized before being displayed to prevent security vulnerabilities.
*   **Rate Limiting**: The module intelligently backs off if it encounters errors or high latency from data sources.
*   **ReDoS Protection**: All regular expressions are audited to ensure they cannot cause "Regular Expression Denial of Service" when processing large amounts of data.
