# AGENTS.md

This file is the canonical instruction set for agent-driven work in this repository.
Keep this file, `README.md`, `TODO.md`, and `CLAUDE.md` aligned to avoid instruction drift.

## Build, test, and lint commands

Run commands from the repository root.

### Setup and local run

```bash
npm install
npm run scss:build
```

This repo is a MagicMirror module, not a standalone web app. Runtime verification normally happens by loading the module in MagicMirror with `provider: "espn_service"` and a reachable `espnSoccerApiBaseUrl` (with `providerSettings.espn_service.baseUrl` only as compatibility fallback).

### Tests

```bash
npm test
npm run test:security
```

### Linting and formatting

```bash
npm run lint
npm run format
npm run scss:build
```

### Validation by change type

- Ensure LF line endings in project files, including markdown, JSON, SCSS, config files, and `TODO.md`.
- For documentation-only changes, do not force JavaScript validation unless commands, defaults, or behavior claims changed and need verification.
- For JavaScript changes, run `npm run lint` and `npm test`.
- For SCSS changes, run `npm run scss:build` so generated CSS stays aligned.
- For configuration or metadata changes, validate with the closest existing command or test surface that exercises the affected behavior.

## Communication style

### `caveman-style` meaning

Terse like caveman. Technical substance exact. Filler die.
Short sentences or fragments OK. Start with result. Explain only useful why.

### Rules

- Reply in brief Spanish by default.
- Use a simple, terse caveman-style tone unless the user explicitly asks for more detail.
- Follow the user's language preference persistently once established.
- Keep menus, confirmations, and workflow prompts fully in Spanish.
- Start with the main result, then add the minimum supporting context.
- Avoid filler, long recaps, and generic offers to continue.
- When a fix is made, explain in real-world language why the old behavior was wrong if that helps the user understand the change.

## Workflow loop

Use this conversational/operational workflow when the user is in "flow" mode.

### Semantic triggers

- Treat start/resume/restart flow wording as a request to enter or resume this workflow loop.
- Treat exit flow wording as a request to stop the workflow loop and stop offering menu options until the user asks to resume it.

### Default flow behavior

1. Re-read the current project state before offering options:
   - check whether there are active or pending tracked tasks
   - re-read `TODO.md`
   - align the visible state with the actual repository state if needed
2. If there is no active front, offer the workflow menu again.
3. After any completed task, loop back automatically:
   - read `TODO.md` again
   - align it with the real codebase state
   - rescan remaining fronts or gaps
   - offer the next choice again

#### `TODO.md` file considerations

- Keep the file titled `Project notes` with a level-1 heading.
- Keep section titles as level-2 headings.
- Keep it operational and compact, not changelog-like.
- Prefer this section structure when it reflects reality:
  - `Current product scope`
  - `Validation state`
  - `Current in progress`
  - `Blocked`
  - `Active findings and notes`
  - `Next candidate fronts`
- Keep each section aligned with the current repo state instead of copying stale text forward.
- Update `TODO.md` when the active front changes, a material finding should persist, or the visible work queue changes.
- If `Next candidate fronts` exists, surface each relevant entry as a real workflow menu option translated into Spanish.

### Workflow menu

Prefer an interactive choice prompt when tools allow it. Otherwise use the same numbered menu:

1. Analyze the project
2. Sync `TODO.md`
3. Add new task
4. Improve coverage
5. Review/Sync markdown documentation and configs
6. Diagnose something
7. Explain something
8. Exit the workflow

- Insert translated `Next candidate fronts` after the first 7 base options and before Exit.
- Recommend the best next option based on current repo state and the workflow decision rules below.

### Confirmation requests

- Prefer an interactive choice prompt when available.
- Structure confirmation dialogs as `Yes`, `No`, and `Do something else`.
- Treat `Do something else` as the free-text path.

### Workflow decision rules

1. Prefer small, low-risk operational cleanup before bigger feature work when multiple paths are reasonable.
2. For intentional product changes, follow approved user direction first.
3. Treat `TODO.md` as the operational tracker, not as a higher-priority spec than user intent, code, or tests.
4. Treat markdown docs and instruction files as secondary guidance that must be kept aligned with the implementation.
5. If the user adds a new task but has not confirmed implementation yet, analyze and frame it first; do not start coding automatically.
6. Keep the user-facing workflow concise, but keep `TODO.md` and guidance docs synchronized with reality.

### Workflow interruptions and resumptions

- If the user asks to return to a previous suggestion, resume from that exact suggestion.
- If the user says the wrong option was chosen, re-show the current menu without dropping context.
- If the user asks to see the menu again, re-offer the current options before moving on.
- If the user changes topics mid-flow, handle the new request directly and only resume the workflow if asked.

### Option-specific rules

#### 1. Analyze the project

- Re-scan the repository.
- Describe the current real project state before deciding whether operational artifacts need updates.
- Do not update `TODO.md` unless the analysis reveals a material operational change.

#### 2. Sync `TODO.md`

- Rebuild, compact, or realign `TODO.md` so it reflects the current real state instead of stale history.
- Prefer an operational `TODO.md` over a changelog-style document.
- If the state is still unclear, analyze first and sync only after the reality is understood.

#### 3. Add new task

- Ask the user to define the task in free text.
- Analyze the current codebase context for that task first.
- Then describe the task back in implementation-plan terms with medium detail.
- Before starting implementation, ask for confirmation using the standard confirmation flow.
- Only after confirmation:
  - update `TODO.md` if the task materially changes the visible work queue
  - start implementation

#### 4. Improve coverage

- Ask the user for a target coverage level when it matters.
- Prefer real low/no-coverage areas tied to the active canonical runtime path.
- Favor tests around provider contracts, adapters, shell helpers, and active competition scope over dead legacy surfaces.

#### 5. Review/Sync markdown documentation and configs

- Audit root markdowns, including `AGENTS.md`, `CLAUDE.md`, `README.md`, and `TODO.md`, when they are part of the affected surface.
- Remove stale statements and align docs with current product scope, commands, defaults, and runtime behavior.
- Keep docs concise and reality-based; do not promise deleted docs, scraper-era features, or inactive assets as live product behavior.
- Audit config/metadata files such as `package.json`, lint config, and related setup when they are part of the affected surface.

#### 6. Diagnose something

- Investigate one concrete case.
- Describe the exact failure mode, impacted surfaces, and likely fix path before changing code if the scope is still ambiguous.

#### 7. Explain something

- Ask the user what they want explained.
- Use medium detail by default.
- Keep it concise unless the user asks for more depth.

#### 8. Exit the workflow

- Acknowledge that the workflow is no longer active.
- Stop offering workflow options until the user asks to resume or restart.

## Do / Don't shortcuts and automation boundaries

- **Do** preserve the active API-first baseline around `uefa.champions`, `col.1`, and `fifa.world`.
- **Do** keep league visibility controlled only by `selectedLeagues`.
- **Do** use provider/API slugs directly instead of resurrecting shorthand aliases.
- **Do** keep canonical socket traffic on `GET_COMPETITION_PAYLOAD` / `COMPETITION_PAYLOAD`.
- **Do** keep provider-native team identities and logos. If the provider gives no logo, leave the gap visible.
- **Do** use `createElement()`, `textContent`, `appendChild()`, and `DocumentFragment`; do not use `innerHTML` for dynamic content.
- **Do** wrap non-critical logging behind `this.config.debug` and prefer MagicMirror `Log` helpers.
- **Do** keep CSS scoped and layout behavior stable.
- **Don't** reintroduce scraper-era parser dependencies, legacy provider chains, `showWC2026`, static team-logo mapping runtime dependencies, or synthetic logo paths in the active runtime.
- **Don't** treat `CHANGELOG.md` as active source of truth for current architecture.
- **Don't** carry stale text forward into `TODO.md`, docs, or guidance files without checking it against the current codebase.

## High-level architecture

- `MMM-SoccerStandings.js`: frontend shell. Renders standings and fixtures, manages tabs/cycling, and consumes canonical competition payloads.
- `competition-provider.js` + `providers/competition-provider-espn-service.js`: frontend provider bootstrap and active provider adapter.
- `canonical-view-adapter.js`: converts canonical payloads into the legacy-shaped UI model the shell still expects.
- `node_helper.js`: backend bridge for canonical competition requests.
- `backend/canonical-provider-registry.js`: backend provider registry.
- `backend/providers/espn-soccer-canonical-provider.js`: active backend provider implementation for `espn_service`.
- `backend/competition-catalog.js`: active competition catalog metadata.
- `constants/competition-keys.js`: stable internal competition identifiers.
- `cache-manager.js`: disk persistence layer used by the backend path.
- `tests/security.test.js`: canonical provider/adapter/helper coverage for the active narrowed scope.

## Key conventions

- Active runtime direction is API-first. Scraping is not part of the intended future path.
- Current product baseline is intentionally narrowed to `uefa.champions`, `col.1`, and `fifa.world`.
- `leagueHeaders` defaults to `{}`; API catalog names are the primary labels unless the user overrides them.
- Team names on the provider path are already normalized; do not resurrect scraper-era normalization rules on the active path.
- Use explicit fixture state flags such as `isLive`, `isUpcoming`, and `isFinished`; never infer state from an ambiguous score like `0-0`.
- Do not show status tags for upcoming fixtures.
- Preserve accessibility work: semantic table roles, keyboard navigation, and descriptive labels matter here.
- Preserve performance work: batch DOM updates, lazy-load images, and avoid noisy production logging.
- Prefer fixed-height, scoped CSS behavior over broad layout changes that introduce shifting or unstable views.

## Testing-specific conventions

- Prefer focused updates to `tests/security.test.js` for canonical provider, adapter, and active-scope behavior.
- When config or doc claims change, verify them against `package.json`, runtime defaults, and the active code path.
- When frontend shell helper behavior changes, validate the narrowest relevant surface first, then widen to `npm test`.

## Repository-specific gotchas

- MagicMirror frontend refresh alone may not pick up `node_helper.js` changes; backend restart may still be required.
- This repo may be in a bulk migration state with many deletions and untracked canonical files; do not assume docs or `TODO.md` are current until you resync them.
- Deleted legacy docs, parsers, and image assets may still appear in archival files. Treat those references as stale history, not live architecture.
