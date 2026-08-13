# Pulse Health

Patient portal for a fictional digital healthcare company, used to show a legacy frontend being
modernised. The backend implements five domains end to end (Appointment Scheduling, Provider
Directory, Patient Profile & Demographics, Prescriptions & Medications, and Billing & Insurance
Claims). The frontend is deliberately scoped down to one of them for now — the **Provider
Directory** (search the directory, open a provider's profile) — after a from-scratch rewrite from
Angular 17/TypeScript to AngularJS 1.x. The other four domains stay fully implemented server-side
and are simply not exposed by the current UI.

| App | What it is |
| --- | --- |
| `apps/portal-angular` | the legacy baseline: AngularJS 1.8.x, plain JS, `ngRoute`, Karma |
| `apps/mock-api` | FastAPI mock backing it, all five domains still live |

The REST contract in [`docs/api-contract.md`](docs/api-contract.md) is frozen — it is written so
that a future migration to another frontend framework requires no backend change. `data-testid`
attributes are already in place on the elements a UI test would target, so behavioural tests can
be ported alongside the components when that migration happens.

## Stack

| Layer | Choice | Why it looks like this |
| --- | --- | --- |
| Frontend | AngularJS 1.8.3, plain JS (no TypeScript) | component controllers registered via `.component()`, `$inject`-style DI |
| Routing | `ngRoute` | one feature module wired into the shell today (Providers); more can be added the same way |
| Forms | `ng-model` plus a custom `trimmedRequired` validator directive | `ngModel.$validators` covers what Reactive Forms did before |
| Async | `$http` promises | no RxJS in this stack |
| Sanitization | `ngSanitize` (`ng-bind-html`) | provider bios come from an unvetted onboarding tool; replaces the original Angular version's `bypassSecurityTrustHtml`, which shipped a stored-XSS bug |
| Styling | one global stylesheet, one component-scoped SCSS file for the app shell | no utility framework |
| Tests | Karma + Jasmine | the same runner the Angular-era app used |
| API | FastAPI 0.141, Python 3.12 | file-backed JSON store, seeded relative to "now" |
| API tests | pytest | rules enforced and asserted server-side, across all five domains |

## Layout

```
pulse-health/
├── package.json                 root commands (dev, test, lint, typecheck, build, demo)
├── AGENTS.md                    invariants and conventions for agents and newcomers
├── docs/api-contract.md         frozen REST contract
├── docs/privacy.md              what happens to data in this demo (no real PHI)
├── .jscpd.json                  duplicate-code budget across both apps
├── .github/workflows/           CI per app, CodeQL, secret scan, flaky-test detection
├── .devcontainer/               Node 22 + Python 3.12, runs npm run setup on create
├── .pre-commit-config.yaml      ruff, mypy, vulture, eslint, knip, jscpd, prettier, hygiene hooks
├── e2e/                         Playwright specs (currently written against the pre-rewrite
│                                app; see "Known constraints" below)
├── apps/
│   ├── portal-angular/          AngularJS patient portal (webpack build, no Angular CLI)
│   │   ├── webpack.config.js    dev server (+ /api proxy), production build, template inlining
│   │   ├── karma.conf.js        headless Chrome, resolved from the puppeteer cache
│   │   └── src/app/
│   │       ├── core/            HTTP error interceptor, global error handler, telemetry,
│   │       │                    notification service
│   │       ├── shared/          badge, spinner, empty state, alert, confirm dialog, filters,
│   │       │                    validator directive
│   │       └── features/
│   │           └── providers/       provider directory + profile pages (the only feature wired
│   │                                into the app today)
│   └── mock-api/                FastAPI mock
│       ├── app/domain/          models, rules, error envelope
│       ├── app/api/             health, providers, patients, visit types, slots, appointments,
│       │                        prescriptions, billing, dev
│       ├── app/observability/   JSON logs, Prometheus /metrics, OpenTelemetry traces
│       ├── prometheus/alerts.yml  alerting rules for the metrics above (validated, not wired up)
│       ├── app/store.py         atomic file-backed persistence
│       ├── demo_server.py       the built frontend + the API on one port
│       └── data/store.json      runtime state (gitignored, reseeds when missing)
```

## Prerequisites

- Node.js 22+ and npm
- Python 3.12+ with `python3-venv` (it does not have to be your default `python3` — see
  [Setup](#setup))
- Karma runs headless Chrome, downloaded automatically by the `puppeteer` devDependency. On a
  bare Linux host Chrome also needs system libraries:

  ```bash
  sudo apt-get install -y libglib2.0-0 libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 \
    libatspi2.0-0 libcups2 libdbus-1-3 libdrm2 libgbm1 libxkbcommon0 libxcomposite1 \
    libxdamage1 libxfixes3 libxrandr2 libpango-1.0-0 libcairo2 libasound2t64 fonts-liberation
  ```

## Setup

```bash
npm install     # root tooling (concurrently)
npm run setup   # backend venv + frontend dependencies
```

`npm run setup:api` looks for a Python that satisfies `apps/mock-api/pyproject.toml` rather than
trusting whatever `python3` resolves to — on macOS that is still 3.9, which cannot install the
pinned dependencies. Point it at a specific interpreter if you have several:

```bash
PYTHON=/opt/homebrew/bin/python3.13 npm run setup:api
```

## Root commands

| Command | What it does |
| --- | --- |
| `npm start` | both: API on :8000, portal-angular on :4200 |
| `npm run start:api` | uvicorn with reload, http://localhost:8000 (docs at `/docs`) |
| `npm run start:angular` | webpack dev server, http://localhost:4200 |
| `npm test` | both unit suites (170 + 12 = 182 tests) |
| `npm run test:api` / `test:angular` | one suite only |
| `npm run test:e2e` | Playwright specs driving the frontend in a real browser |
| `npm run lint` | ruff, then eslint |
| `npm run typecheck` | mypy (strict); portal-angular is plain AngularJS/JS, so its typecheck step is a no-op |
| `npm run format` | Prettier over TS/JS/JSON/YAML |
| `npm run build` | production bundle |
| `npm run demo` | build the frontend and serve it with the API on one port |
| `npm run reset:data` | reseed the API store while it is running |

The dev server proxies `/api` to the API, so the browser sees one origin and CORS does not apply
in development.

### Viewing the app from another machine

When the repo runs on a remote host or container and you browse from your own machine, use:

```bash
npm run start:api    # in one shell, if it is not already running
npm run demo         # in another: builds the bundle, serves on :8080
```

Forward the single port (`8080`) and open http://localhost:8080/.

Prefer this over forwarding the dev server. Live reload holds a websocket open for the lifetime
of the page and some tunnels handle that badly: the first page load succeeds and every request
after it hangs. `npm run demo` serves a compiled bundle over plain HTTP, so every connection is
short-lived. It also has no file watcher, so rerun `npm run demo:build` after changing code.

## Demo script

```bash
npm start
```

Then open http://localhost:4200, which redirects to `/providers` — the only route the app
serves today.

### Provider Directory

1. **Browse and search.** `/providers` lists all four providers; the search box filters by name
   or specialty client-side.
2. **Profile.** Click a provider to see their full bio alongside their credentials and location.
   The bio is rendered with `ng-bind-html` through `ngSanitize`, so markup in it is sanitized
   rather than trusted outright — the original Angular version bypassed sanitization here, which
   was a stored-XSS bug.
3. **Not found.** An unknown id in the URL shows a not-found error instead of a blank page.
4. **API error state.** Stop the API (`Ctrl+C` in the `api` pane) and reload. You get an error
   banner instead of a silent failure, recovering once the API is back.
5. **Back to a clean slate.** `npm run reset:data` reseeds providers relative to the current
   time (also reseeds the other four domains, exercised only via the API/tests today).

The other four domains — Appointments, Patient Profile, Prescriptions, Billing — are fully
implemented and tested server-side (see [`docs/api-contract.md`](docs/api-contract.md)) but have
no current AngularJS UI; the previous Angular 17 pages for them were removed as part of the
rewrite rather than ported.

## Business rules

Enforced in the API regardless of what the current UI exposes. The full set for every domain —
Appointments, Provider Directory, Patient Profile, Prescriptions, Billing — is enumerated in
[`docs/api-contract.md`](docs/api-contract.md#business-rules). A few examples:

| Rule | Where | Failure surfaced as |
| --- | --- | --- |
| No booking in the past | `app/domain/rules.py` | `SLOT_IN_PAST` (422) |
| A slot cannot be booked twice | `app/domain/rules.py` | `SLOT_ALREADY_BOOKED` (409) |
| Completed appointments cannot be cancelled | `app/domain/rules.py` | `APPOINTMENT_NOT_CANCELLABLE` (409) |
| Appointments survive a refresh | `app/store.py` | state reloaded from disk |
| Provider bio is sanitized before render | `provider-profile.page.html` (`ng-bind-html` + `ngSanitize`) | unsafe markup stripped, not executed |

## Tests

```bash
npm test
```

- **API, 170 tests.** Every rule and error code, filter and ordering behaviour, the error envelope
  shape for malformed bodies, slot freeing on cancel and swapping on reschedule, and persistence
  across a store reload, across all five domains (appointments, providers, patients,
  prescriptions, billing) — the API's own test coverage was untouched by the frontend rewrite.
  Plus observability: correlation ids, metric label cardinality, the JSON log line's shape, the
  log scrubber's allowlist, and POST /api/telemetry's validation and logging/metrics fan-out, and
  two tests that pin the `/api` payload and error-envelope shapes so the frozen contract cannot
  drift.
- **AngularJS, 12 tests.** The provider directory service (list/get by id), the directory page
  (search/filter, loading and error states), and the profile page (load by route id, not-found
  redirect, error state) — including a regression test that compiles the real profile template
  against an XSS payload in the bio field and asserts the sanitizer strips it. Scoped to the one
  feature currently wired into the app; the ~94 specs that covered the removed features were
  deleted along with them, not ported.

```bash
npm run test:e2e
```

- **End to end.** The Playwright specs in `e2e/` were written against the pre-rewrite app (five
  features plus a dashboard) and have not been updated for the AngularJS/Providers-only scope, so
  most of them no longer match what the frontend serves. Not run in CI today; treat as stale
  until someone reconciles them with the current app.

## Notes for the migration phase

- The API is the contract. A future frontend rewrite should reuse `docs/api-contract.md`
  verbatim; no backend change is required.
- The frontend already went through one rewrite in place (Angular 17/TypeScript →
  AngularJS 1.x), scoped down to the Provider Directory feature. The other four domains'
  Angular 17 pages were deleted rather than ported; reintroducing them means writing new
  AngularJS pages against the existing, unchanged API.
- `data-testid` attributes are already in place on the elements a UI test would target, so
  behavioural tests can be ported alongside the components when features are added back.

## Known constraints

- Python venvs record absolute paths. After moving or renaming this repository, rerun
  `npm run setup:api`.
- The `e2e/` Playwright suite predates the AngularJS rewrite and targets removed pages/routes;
  see "Tests" above.
- `apps/portal-angular`'s `shared/` module still registers a couple of AngularJS components,
  filters, and a validator directive (`ph-confirm-dialog`, `ph-status-badge`, `titlecase`,
  `visitTypeLabel`, `trimmedRequired`) that nothing in the current Providers-only app uses —
  leftover from the removed Appointments/Billing features. They're harmless but dead until a
  future feature needs them again.
