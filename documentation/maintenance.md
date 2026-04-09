# Module Maintenance Guide

Maintaining the **MMM-MyTeams-LeagueTable** module ensures data accuracy and stability throughout the football season. This guide covers essential housekeeping tasks and the critical seasonal updates required.

## 1. Seasonal URL Updates (Critical)

Every year, typically between July and August, the module's URL maps must be updated for the new football season. Some providers use season-specific URLs that will break or show old data if not updated.

### A. Wikipedia URLs
Wikipedia articles are usually titled by the season (e.g., "2025–26 Premier League").
*   **Format**: Aug-May leagues use an en-dash encoded as `%E2%80%93` (e.g., `2025%E2%80%9326`).
*   **Calendar Year**: Leagues like Norway and Sweden use a single year (e.g., `2026`).
*   **Action**: Update the `wikipediaUrlMap` in `MMM-MyTeams-LeagueTable.js`. Ensure the en-dash encoding is correct to avoid 404 errors.

### B. Soccerway URLs
Soccerway uses a unique ID for each season (`r#####`).
*   **Action**: Visit the Soccerway website for each league, navigate to the current season's table, and copy the new URL including the `r#####` ID.
*   **Update**: Modify the `soccerwayUrlMap` in `MMM-MyTeams-LeagueTable.js`.

### C. ESPN & BBC Sport
*   **ESPN**: These URLs are generally path-based (e.g., `/soccer/standings/_/league/eng.1`) and rarely change between seasons.
*   **BBC Sport**: These are also path-based (e.g., `/sport/football/premier-league/table`).
*   **Note**: During league-split phases (e.g., in Romania), the BBC table page may disappear (404). This is why the fallback provider system is critical.

## 2. League Split Verification

Leagues with mid-season splits (Romania, Scotland, Austria, etc.) may change their format or naming conventions on Wikipedia each season.
*   **Action**: Verify the `LEAGUE_SPLITS` constant in `MMM-MyTeams-LeagueTable.js`.
*   **Check Keywords**: Ensure the `keywords` in each group (and `championshipKeywords` / `relegationKeywords`) match the actual `<h2>` to `<h4>` headings used in the new season's Wikipedia article (e.g., "Championship round" vs. "Play-off Round").
*   **Check Sizes**: Verify if the number of teams in each group has changed (e.g., Belgium sometimes changes group sizes).
*   **Verify Logic**: Ensure the `regularSeasonGames` count is correct for the new season's format to trigger the multi-group extraction at the right time.
*   **Logo Check**: Some leagues change their name or crest (e.g., "Super Liga" vs "Liga I"). Ensure `LEAGUE_SPLITS` keys and `wikipediaUrlMap` remain synchronized.

## 3. Regular Housekeeping

### A. Cache Management
The module automatically cleans up expired cache files, but manual maintenance is sometimes needed:
*   **Clear All Cache**: If you see corrupted data or want to force a fresh start, use the "Clear All Cache" button in the module's settings/footer or use the MagicMirror terminal to delete files in the `.cache/` directory.
*   **Disk Usage**: Periodically check the `.cache/` folder to ensure it hasn't grown excessively (though the auto-cleanup should prevent this).

### B. Logo Mapping
New teams are promoted to top-tier leagues every season.
*   **Identify Missing Logos**: Check the terminal logs for `[LogoResolver] NO LOGO FOUND` warnings.
*   **Update Mappings**: Add new team name to image path mappings in `team-logo-mappings.js`.
*   **Add Images**: Ensure the corresponding `.png` crest image is added to the `images/crests/` subfolder.

## 4. Security & Performance Review

*   **Linting**: Run `npm run lint` regularly to ensure code quality.
*   **Dependencies**: Run `npm audit` to check for security vulnerabilities in the underlying `node-fetch` or other packages.
*   **Logs**: Check the `~/.pm2/logs/` or terminal output for `[SharedRequestManager]` errors, which can indicate if a provider is rate-limiting the module.

## 5. Maintenance Checklist (Pre-Season)

1. [ ] Update all **Wikipedia** URLs to the new season year.
2. [ ] Update all **Soccerway** URLs with new `r#####` IDs.
3. [ ] Verify **LEAGUE_SPLITS** keywords against current Wikipedia headings.
4. [ ] Identify promoted teams and add their **logos** to `images/crests/`.
5. [ ] Update **team-logo-mappings.js** for promoted teams.
6. [ ] Clear the `.cache/` directory to ensure no old-season data remains.
7. [ ] Run `npm run lint` and `npm test` (if available) to verify stability.
