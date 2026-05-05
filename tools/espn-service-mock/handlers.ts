/**
 * MSW request handlers that back the ESPN service mock.
 *
 * These handlers are consumed in two ways:
 *
 *  1. Dev / sandbox — `server.ts` wraps them in an HTTP server bound to
 *     port 3200 via `@mswjs/http-middleware`, so `node_helper.js` can
 *     reach http://127.0.0.1:3200 without any change.
 *
 *  2. Tests — import `handlers` directly and pass them to
 *     `setupServer(...handlers)` from `msw/node` for in-process
 *     interception (no real network traffic, no port required).
 */
import { http, HttpResponse } from "msw";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

const fixturesRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "espn-service"
);

interface PaginatedResponse<T = Record<string, unknown>> {
  count: number;
  next: null;
  previous: null;
  results: T[];
}

function readFixture<T = Record<string, unknown>>(
  fileName: string
): PaginatedResponse<T> {
  return JSON.parse(
    fs.readFileSync(path.join(fixturesRoot, fileName), "utf8")
  ) as PaginatedResponse<T>;
}

const FILE_MAP: Record<string, { standings: string; fixtures: string }> = {
  "uefa.champions": {
    standings: "standings.uefa.champions.json",
    fixtures: "fixtures.uefa.champions.json"
  },
  "col.1": {
    standings: "standings.col.1.json",
    fixtures: "fixtures.col.1.json"
  },
  "fifa.world": {
    standings: "standings.fifa.world.json",
    fixtures: "fixtures.fifa.world.json"
  }
};

function getLeagueData(
  league: string | null | undefined,
  kind: "standings" | "fixtures"
): PaginatedResponse {
  const entry =
    FILE_MAP[
      String(league ?? "")
        .trim()
        .toLowerCase()
    ];
  if (!entry) {
    return { count: 0, next: null, previous: null, results: [] };
  }
  return readFixture(entry[kind]);
}

function filterByDateRange(
  results: Record<string, unknown>[],
  dateFrom: string | undefined,
  dateTo: string | undefined
): Record<string, unknown>[] {
  if (!dateFrom && !dateTo) return results;
  return results.filter((f) => {
    const fixtureDate = String((f as { date?: string }).date ?? "").split(
      "T"
    )[0];
    if (!fixtureDate) return true;
    if (dateFrom && fixtureDate < dateFrom) return false;
    if (dateTo && fixtureDate > dateTo) return false;
    return true;
  });
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

export const handlers = [
  /**
   * GET /api/v1/leagues/
   *
   * Optional `slug` query param filters the result set to the single matching
   * league (case-insensitive).
   */
  http.get("*/api/v1/leagues/", ({ request }) => {
    const url = new URL(request.url);
    const data = readFixture("leagues.json");
    const slug = url.searchParams.get("slug")?.trim().toLowerCase() ?? null;

    if (slug) {
      const filtered = data.results.filter(
        (l) =>
          String((l as { slug?: string }).slug ?? "").toLowerCase() === slug
      );
      return HttpResponse.json({
        count: filtered.length,
        next: null,
        previous: null,
        results: filtered
      });
    }

    return HttpResponse.json(data);
  }),

  /**
   * GET /api/v1/standings/
   *
   * Required `league` param selects the fixture file.
   * Optional `current=true` keeps only the most-recent season year.
   * Optional `season=<year>` filters by an explicit season year.
   */
  http.get("*/api/v1/standings/", ({ request }) => {
    const url = new URL(request.url);
    const data = getLeagueData(url.searchParams.get("league"), "standings");
    let results = data.results;

    if (url.searchParams.get("current") === "true") {
      const years = results
        .map((r) => Number((r as { season_year?: unknown }).season_year))
        .filter(Number.isFinite);
      const latestYear = years.length > 0 ? Math.max(...years) : null;
      if (latestYear != null) {
        results = results.filter(
          (r) =>
            Number((r as { season_year?: unknown }).season_year) === latestYear
        );
      }
    } else if (url.searchParams.get("season")) {
      const season = Number(url.searchParams.get("season"));
      if (Number.isFinite(season)) {
        results = results.filter(
          (r) => Number((r as { season_year?: unknown }).season_year) === season
        );
      }
    }

    return HttpResponse.json({
      count: results.length,
      next: null,
      previous: null,
      results
    });
  }),

  /**
   * GET /api/v1/fixtures/
   *
   * Required `league` param selects the fixture file.
   * Optional `season=<year>` filters by `league_phase.season_year`.
   * Optional `date_from` / `date_to` (YYYY-MM-DD) filter by `date` field.
   */
  http.get("*/api/v1/fixtures/", ({ request }) => {
    const url = new URL(request.url);
    const data = getLeagueData(url.searchParams.get("league"), "fixtures");

    const seasonParam = url.searchParams.get("season");
    const season =
      seasonParam != null && seasonParam !== "" ? Number(seasonParam) : null;

    let results =
      season != null && Number.isFinite(season)
        ? data.results.filter((r) => {
            const phaseYear = (
              r as { league_phase?: { season_year?: unknown } }
            ).league_phase?.season_year;
            return phaseYear == null || Number(phaseYear) === season;
          })
        : data.results;

    results = filterByDateRange(
      results,
      url.searchParams.get("date_from") ?? undefined,
      url.searchParams.get("date_to") ?? undefined
    );

    return HttpResponse.json({
      count: results.length,
      next: null,
      previous: null,
      results
    });
  })
];
