# ESPN service mock

Fixture-backed mock for the narrowed API shape consumed by `MMM-SoccerStandings`.

Purpose:

- run the module against deterministic local data
- keep the mock separate from the sandbox runtime
- let the sandbox stay agnostic about which API it talks to

## Command

```bash
npm run mock-api:start
```

Default URL:

- `http://127.0.0.1:3200`

## Supported endpoints

- `GET /api/v1/leagues/`
- `GET /api/v1/standings/?league=<slug>`
- `GET /api/v1/fixtures/?league=<slug>`

## Fixture source

```text
tools\espn-service-mock\fixtures\espn-service\
```

Current league scope:

- `col.1`
- `uefa.champions`
- `fifa.world`

## Using it with the sandbox

1. start the mock:

```bash
npm run mock-api:start
```

2. point the harness module config at it:

```javascript
espnSoccerApiBaseUrl: "http://127.0.0.1:3200"
```

3. run the harness:

```bash
npm run harness:watch
```
