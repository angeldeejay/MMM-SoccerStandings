# ESPN service mock

Fixture-backed mock for the narrowed API shape consumed by `MMM-SoccerStandings`.

Purpose:

- run the module against deterministic local data
- keep the mock separate from the sandbox runtime
- let the sandbox stay agnostic about which API it talks to
- reuse the same MSW handlers for in-process test interception (no port required)

## Command

```bash
node --run mock-api:start
```

Default URL: `http://127.0.0.1:3200`

## Environment variables

| Variable                 | Default     | Description  |
| ------------------------ | ----------- | ------------ |
| `ESPN_SERVICE_MOCK_HOST` | `127.0.0.1` | Bind address |
| `ESPN_SERVICE_MOCK_PORT` | `3200`      | TCP port     |

## Supported endpoints

All responses use DRF-style pagination: `{ count, next, previous, results }`.

### `GET /api/v1/leagues/`

Returns all available leagues.

| Query param | Required | Description                                                |
| ----------- | -------- | ---------------------------------------------------------- |
| `slug`      | no       | Case-insensitive filter — returns only the matching league |

```bash
# All leagues (count: 3)
curl http://127.0.0.1:3200/api/v1/leagues/

# Single league
curl "http://127.0.0.1:3200/api/v1/leagues/?slug=col.1"
```

---

### `GET /api/v1/standings/`

Returns standings rows for a league.

| Query param | Required | Description                                               |
| ----------- | -------- | --------------------------------------------------------- |
| `league`    | yes      | League slug — selects fixture file                        |
| `current`   | no       | `true` keeps only rows from the most-recent `season_year` |
| `season`    | no       | Integer year — filters rows by `season_year`              |

```bash
# All standings rows for Colombian Primera A
curl "http://127.0.0.1:3200/api/v1/standings/?league=col.1"

# Current season only
curl "http://127.0.0.1:3200/api/v1/standings/?league=col.1&current=true"

# Explicit year
curl "http://127.0.0.1:3200/api/v1/standings/?league=col.1&season=2025"
```

---

### `GET /api/v1/fixtures/`

Returns fixtures for a league.

| Query param | Required | Description                                          |
| ----------- | -------- | ---------------------------------------------------- |
| `league`    | yes      | League slug — selects fixture file                   |
| `season`    | no       | Integer year — filters by `league_phase.season_year` |
| `date_from` | no       | `YYYY-MM-DD` — inclusive lower bound on `date` field |
| `date_to`   | no       | `YYYY-MM-DD` — inclusive upper bound on `date` field |

```bash
# All fixtures
curl "http://127.0.0.1:3200/api/v1/fixtures/?league=col.1"

# Date range
curl "http://127.0.0.1:3200/api/v1/fixtures/?league=col.1&date_from=2025-01-01&date_to=2025-06-30"
```

## Fixture data

```text
tools/espn-service-mock/fixtures/espn-service/
  leagues.json
  standings.col.1.json
  standings.uefa.champions.json
  standings.fifa.world.json
  fixtures.col.1.json
  fixtures.uefa.champions.json
  fixtures.fifa.world.json
```

Available league slugs: `col.1`, `uefa.champions`, `fifa.world`.

Unknown slugs return `{ count: 0, results: [] }`.

## Using handlers in tests

Import `handlers` directly from `./handlers` and pass them to `setupServer` from `msw/node` for in-process interception — no port, no real network:

```typescript
import { setupServer } from "msw/node";
import { handlers } from "../tools/espn-service-mock/handlers.js";

const server = setupServer(...handlers);
beforeAll(() => server.listen());
afterAll(() => server.close());
```

## Using it with the sandbox

1. Start the mock:

```bash
node --run mock-api:start
```

2. Point the module config at it:

```javascript
providerSettings: {
  espn_service: {
    baseUrl: "http://127.0.0.1:3200";
  }
}
```

Config file: `config/module.config.json`

3. Start the sandbox:

```bash
node --run sandbox:watch
```
