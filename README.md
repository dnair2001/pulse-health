# Pulse Health

Patient portal for a fictional digital healthcare company, used to show a legacy frontend being
modernised. The backend implements five domains end to end (Appointment Scheduling, Provider
Directory, Patient Profile & Demographics, Prescriptions & Medications, and Billing & Insurance
Claims). The frontend is deliberately scoped down to one of them — the **Provider Directory**
(search the directory, open a provider's profile) — and exists twice: once as the legacy AngularJS
app, and once as its Angular 22 port. The other four domains stay fully implemented server-side
and are simply not exposed by either UI.

| App | What it is |
| --- | --- |
| `apps/portal-angular` | the legacy baseline: AngularJS 1.8.x, plain JS, `ngRoute`, webpack, Karma |
| `apps/portal-angular-v22` | the migrated app: Angular 22, standalone components, signals, zoneless, Vitest |
| `apps/mock-api` | FastAPI mock backing both, all five domains still live |

The REST contract in [`docs/api-contract.md`](docs/api-contract.md) is frozen — the Angular 22
port required no backend change at all, which is the point of writing it that way. Both
frontends carry the same `data-testid` attributes on the elements a UI test would target, so
behavioural tests transfer between them.

## Stack

| Layer | Legacy (`portal-angular`) | Port (`portal-angular-v22`) |
| --- | --- | --- |
| Framework | AngularJS 1.8.3, plain JS (no TypeScript), `.component()` controllers with `$inject` DI | Angular 22, TypeScript strict, standalone components, `inject()`, signals, zoneless |
| Routing | `ngRoute` | `provideRouter` with `loadComponent` and `withComponentInputBinding()` |
| Async | `$http` promises | `HttpClient` + RxJS, one functional `HttpInterceptorFn` for error mapping |
| Sanitization | `ngSanitize` (`ng-bind-html`) | `[innerHTML]` through Angular's built-in sanitizer |
| Styling | one global stylesheet plus a component-scoped SCSS file for the shell | design tokens global, everything else co-located per component |
| Build | webpack (no Angular CLI) | Angular CLI / `@angular/build` |
| Tests | Karma + Jasmine | Vitest + jsdom via `@angular/build:unit-test` |

Provider bios come from an unvetted internal onboarding tool. Both frontends therefore render
`bio` through a sanitizer; the original Angular 17 version used
`DomSanitizer.bypassSecurityTrustHtml` here and shipped a stored-XSS bug, and neither current app
may reintroduce a trust-bypass call on that field.

The backend, shared by both:

| Layer | Choice | Why it looks like this |
| --- | --- | --- |
| API | FastAPI 0.141, Python 3.12 | file-backed JSON store, seeded relative to "now" |
| API tests | pytest | rules enforced and asserted server-side, across all five domains |

## Layout

```
pulse-health/
├── package.json                 root commands (dev, test, lint, typecheck, build, demo)
├── AGENTS.md                    invariants and conventions for agents and newcomers
├── docs/api-contract.md         frozen REST contract
├── docs/privacy.md              what happens to data in this demo (no real PHI)
├── .jscpd.json                  duplicate-code budget across all three source trees
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
│   ├── portal-angular-v22/      Angular 22 port of the same feature (Angular CLI, Vitest)
│   │   ├── angular.json         build/serve (+ /api proxy on :4201)/test/lint targets
│   │   ├── eslint.config.js     angular-eslint over TypeScript and templates
│   │   └── src/app/
│   │       ├── core/            functional HTTP error interceptor, ErrorHandler, telemetry
│   │       ├── shared/          alert banner, loading spinner, empty state
│   │       └── features/
│   │           └── providers/       typed API client + the two pages, lazily loaded
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
| `npm start` | all three: API on :8000, portal-angular on :4200, portal-angular-v22 on :4201 |
| `npm run start:api` | uvicorn with reload, http://localhost:8000 (docs at `/docs`) |
| `npm run start:angular` | webpack dev server, http://localhost:4200 |
| `npm run start:angular-v22` | Angular CLI dev server, http://localhost:4201 |
| `npm test` | all three unit suites (170 + 12 + 22 = 204 tests) |
| `npm run test:api` / `test:angular` / `test:angular-v22` | one suite only |
| `npm run test:e2e` | Playwright specs driving the AngularJS frontend in a real browser |
| `npm run lint` | ruff, then eslint for both frontends |
| `npm run typecheck` | mypy (strict) and `tsc --noEmit` for portal-angular-v22; portal-angular is plain AngularJS/JS, so its typecheck step is a no-op |
| `npm run format` | Prettier over TS/JS/JSON/YAML |
| `npm run build` | production bundle for both frontends |
| `npm run demo` | build the AngularJS frontend and serve it with the API on one port |
| `npm run reset:data` | reseed the API store while it is running |

Both dev servers proxy `/api` to the API, so the browser sees one origin and CORS does not apply
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

Then open http://localhost:4200 (AngularJS) or http://localhost:4201 (Angular 22). Both redirect
to `/providers` — the only route either app serves today — and both should behave identically;
comparing them side by side is the demo.

### Provider Directory

1. **Browse and search.** `/providers` lists all four providers; the search box filters by name
   or specialty client-side (the API has no search parameter).
2. **Profile.** Click a provider to see their full bio alongside their credentials and location.
   The bio is sanitized before render — `ng-bind-html` through `ngSanitize` in AngularJS,
   `[innerHTML]` through Angular's built-in sanitizer in the port — so markup in it is stripped
   rather than trusted outright. The original Angular 17 version bypassed sanitization here,
   which was a stored-XSS bug. `prv_002`'s seeded bio carries a script-bearing payload, so this
   is visible without editing any data.
3. **Not found.** An unknown id in the URL shows a not-found error instead of a blank page.
4. **API error state.** Stop the API (`Ctrl+C` in the `api` pane) and reload. You get an error
   banner instead of a silent failure, recovering once the API is back.
5. **Back to a clean slate.** `npm run reset:data` reseeds providers relative to the current
   time (also reseeds the other four domains, exercised only via the API/tests today).

The other four domains — Appointments, Patient Profile, Prescriptions, Billing — are fully
implemented and tested server-side (see [`docs/api-contract.md`](docs/api-contract.md)) but have
no UI in either frontend; the previous Angular 17 pages for them were removed as part of the
AngularJS rewrite rather than ported.

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
| Provider bio is sanitized before render | both `provider-profile.page.html`s (`ng-bind-html` + `ngSanitize`; `[innerHTML]`) | unsafe markup stripped, not executed |

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
- **Angular 22, 22 tests.** The same ground, rendered rather than controller-level: the API client
  (list, get by id, correlation-id header and its non-secure-context fallback, and the error
  envelope / unreachable-API / non-envelope mappings the interceptor performs), the directory page
  (loading, populated, filtered, empty, error-and-retry, navigation) and the profile page
  (loading, populated, not-found, server error, back) — including the same XSS regression,
  asserting an `<img onerror=…>` bio renders inert.

```bash
npm run test:e2e
```

- **End to end.** The Playwright specs in `e2e/` were written against the pre-rewrite app (five
  features plus a dashboard) and have not been updated for the AngularJS/Providers-only scope, so
  most of them no longer match what the frontend serves. Not run in CI today; treat as stale
  until someone reconciles them with the current app.

## Notes on the migration

- The API is the contract, and it held: porting the Provider Directory from AngularJS to
  Angular 22 required no change to `apps/mock-api` or `docs/api-contract.md`.
- The AngularJS app stays in the repo on purpose. It is the reference implementation and the
  before/after comparison, so it is not deleted or refactored as part of a port.
- The two frontends' behaviour is currently held equivalent by their unit specs and a manual
  pass, not mechanically: the `equivalence.spec.ts` that used to diff two frontends' rendered
  text went away with the old React port and has not been recreated (see "Known constraints").
- The other four domains have no UI in either app. Reintroducing one means writing new pages
  against the existing, unchanged API — in `portal-angular-v22`, since new features belong in
  the modern app.
- `data-testid` attributes are in place on the elements a UI test would target, and the port
  keeps the same values, so behavioural tests transfer between the two frontends.

## Known constraints

- Python venvs record absolute paths. After moving or renaming this repository, rerun
  `npm run setup:api`.
- The `e2e/` Playwright suite predates the AngularJS rewrite and targets removed pages/routes;
  see "Tests" above. Its `IMPLEMENTATIONS` fixture still lists one frontend, so it does not
  exercise `portal-angular-v22` and there is no automated cross-frontend equivalence check.
- `npm run demo` serves the AngularJS bundle only: `demo_server.py` lives in the frozen
  `apps/mock-api` and points at `apps/portal-angular`'s `dist`. Use `npm run start:angular-v22`
  for the Angular 22 app.
- The Angular 22 CLI needs Node `^22.22.3 || ^24.15.0 || >=26.0.0` — a Node 24.13 or Node 25
  install will refuse to run `ng` at all. `.nvmrc` (`22`) resolves to a qualifying release.
- `apps/portal-angular`'s `shared/` module still registers a couple of AngularJS components,
  filters, and a validator directive (`ph-confirm-dialog`, `ph-status-badge`, `titlecase`,
  `visitTypeLabel`, `trimmedRequired`) that nothing in the current Providers-only app uses —
  leftover from the removed Appointments/Billing features. They're harmless but dead until a
  future feature needs them again.
