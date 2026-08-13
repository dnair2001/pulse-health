# Pulse Health

A patient portal demo whose purpose is to show a **legacy Angular app being modernized**. It
contains a dashboard plus five patient-facing features (Appointment Scheduling, Provider
Directory, Patient Profile & Demographics, Prescriptions & Medications, Billing & Insurance
Claims), each implemented in Angular against a frozen HTTP contract that a future frontend
migration can reuse verbatim:

| App | Path | Role |
| --- | --- | --- |
| `mock-api` | `apps/mock-api` | FastAPI, Python 3.12. Owns all business rules and the frozen contract. |
| `portal-angular` | `apps/portal-angular` | AngularJS 1.8.x, plain JS, `ngRoute`, Karma. The deliberately period-accurate legacy app, scoped to the Provider Directory. **Reference implementation.** |
| `portal-angular-v22` | `apps/portal-angular-v22` | Angular 22: standalone components, signals, zoneless, Vitest. The migrated app, same feature, same API. |

The two frontends are both wired up and both maintained: `portal-angular-v22` is the port of
`portal-angular`'s Provider Directory, and `portal-angular` stays in place as the reference
implementation and the before/after comparison. Neither one needed a backend change —
`docs/api-contract.md` is the frozen spec both build against. The four remaining domains
(Appointments, Patient Profile, Prescriptions, Billing) are API-only in both frontends; porting
one means writing new pages against the existing, unchanged API.

## Setup

```bash
npm install          # root tooling (concurrently, prettier)
npm run setup        # python venv, Angular node_modules, Playwright chromium
npm run setup:hooks  # optional: install the pre-commit hooks
```

Requires Node 22 (see `.nvmrc`) and Python 3.12+. `.devcontainer/` defines a container with both
toolchains that runs `npm run setup` on create.

## Commands

Always use the root scripts. They exist so nobody has to remember per-app invocations.

| Command | What it does |
| --- | --- |
| `npm start` | All three dev servers: API `:8000`, AngularJS `:4200`, Angular 22 `:4201` |
| `npm test` | Unit suite: 170 pytest + 12 Karma + 30 Vitest = **212** |
| `npm run test:e2e` | Builds, then runs the Playwright specs against the AngularJS frontend |
| `npm run lint` | ruff + eslint for both frontends, each including a complexity budget (see below) |
| `npm run typecheck` | mypy (strict) + `tsc --noEmit` over portal-angular-v22 + a no-op for portal-angular (plain AngularJS/JS, no TS) |
| `npm run format` / `format:check` | Prettier over TS/JS/JSON/YAML |
| `npm run build` | Production bundle for both frontends |
| `npm run demo` | Builds, then serves the AngularJS frontend + API on `:8080` |
| `npm run reset:data` | Reseeds the mock API relative to now (needs the API running) |
| `npm run generate:openapi` | Regenerates `apps/mock-api/openapi.json` from the live schema; CI fails if it's stale |
| `npm run check:duplication` | jscpd duplicate-code budget across all three source trees (`.jscpd.json`) |
| `npm run check:doc-freshness` | Confirms this file's/README's/CONTRIBUTING's/the PR template's documented test counts still match the live suites |

Both frontends proxy `/api` to `localhost:8000`, so the API must be running to show data.
Per-app variants exist for tight loops: `test:api`, `test:angular` (AngularJS),
`test:angular-v22` (Angular 22), and the same pattern for `setup:`, `start:`, `lint:`,
`typecheck:` and `build:`.

`npm run test:e2e` is deliberately **not** part of `npm test`: it needs a production build first,
and keeping the unit suite fast matters more than a single entry point.

The demo server (`apps/mock-api/demo_server.py`) serves the AngularJS bundle at `/` and the API
at `/api`. It reads a pre-built bundle, so run `npm run demo` (which builds first) rather than
`demo:serve` alone. It is part of the frozen `apps/mock-api`, so it still points at
`apps/portal-angular`'s `dist`; serving the Angular 22 app over one port means
`npm run build:angular-v22` plus your own static server, or `npm run start:angular-v22`.

## Static analysis, SAST and alerting

Beyond lint/typecheck/test, each app carries a **measured-baseline** budget: thresholds are set
at (or just above) what the codebase measured when the check was added, not at some aspirational
number, so they catch new regressions without demanding an unrelated rewrite to pass.

- **Complexity** — ruff's `C90`/mccabe for mock-api (`pyproject.toml`, `max-complexity = 10`),
  `complexity`/`max-depth`/`max-lines-per-function` in AngularJS's `.eslintrc.json`
  (`overrides`-scoped off for spec/test files, since test callbacks trip these for reasons
  unrelated to production code quality).
- **Dead code / unused dependencies** — `vulture` + `pip-extra-reqs` for mock-api (run directly
  via `apps/mock-api/.venv/bin/...`; config lives in `pyproject.toml`); `knip` for the AngularJS
  frontend (`npm run lint:deadcode` in `apps/portal-angular`; `knip.json` carries the framework
  false-positives — Angular schematics/template-parser/puppeteer — that knip's static import
  graph can't see). `portal-angular-v22` has no knip config yet: its lint (angular-eslint, over
  TypeScript **and** templates) plus `tsc --noEmit` is the whole budget there today.
- **Duplicate code** — `jscpd` at the root (`.jscpd.json`, `npm run check:duplication`), scanning
  all three source trees. Expect the two frontends' templates to report a few clones against each
  other: the port has to reproduce the AngularJS markup, so that duplication is the point rather
  than a smell. The threshold is a total-percentage budget, and those clones sit well inside it.

All of the above run in CI (see `.github/workflows/ci.yml`'s `api`/`angular`/`angular-v22`/
`quality` jobs) and as local pre-commit hooks.

**SAST** — `.github/workflows/codeql.yml` runs CodeQL over `python` and `javascript-typescript`
on every PR, push to `main`, and weekly. It is a separate workflow, not a required check in
`ci.yml`.

**Automated PR review** — deferred. The plan is a `droid-review.yml` workflow running Factory
Droid's automatic code + security review on every PR, since branch protection here requires zero
human approvals and this would give every PR at least one review regardless. Blocked on the
Factory Droid GitHub App being installed on this repo, which currently fails with a Factory-side
org-permission error before the GitHub App install step completes. No workflow file exists in the
repo yet, so there's no check to see or ignore on PRs — this is a clean gap, not a broken one.

**Alerting** — `apps/mock-api/prometheus/alerts.yml` defines Prometheus alerting rules against
the metrics in `app/observability/metrics.py` (frontend error rate, booking 5xx rate). Nothing in
this repo runs Prometheus/Alertmanager, so these rules are not wired to page anyone; CI validates
them with `promtool check rules` so they stay syntactically correct for whoever does point a real
Prometheus at this demo.

## Hard invariants

Breaking any of these is a defect, not a style preference.

1. **The API contract is frozen.** `docs/api-contract.md` is the specification: camelCase keys,
   UTC ISO-8601 with a `Z` suffix, bare JSON arrays from collection endpoints, one error
   envelope. Do not rename a field, change a status code, or wrap a response. If a frontend
   needs different data, that is a signal to reconsider the frontend.
2. **Business rules live server-side.** Double-booking rejection, cancellation windows, and
   validation are enforced in `apps/mock-api/app/domain/rules.py` and returned as typed error
   codes. The frontend surfaces those errors; it must not become the source of truth for them. A
   client-side-only guard is a bug because it can be bypassed and it makes the contract dishonest.
3. **`apps/portal-angular` is deliberately legacy and is the reference implementation for the
   migration.** Do not modernize it (no standalone components, no signals, no functional
   interceptors — see "Per-app conventions" below for the specific patterns to keep) and do not
   delete it: `apps/portal-angular-v22` is only meaningful next to it. A port must reproduce its
   observable behaviour exactly — same labels, date formats, empty states, and punctuation
   (including the en dash in time ranges) — not a framework-idiomatic reinterpretation of it.
   When this repo previously had a React port, this was mechanically enforced by an equivalence
   spec that diffed the two frontends' rendered text (`e2e/tests/equivalence.spec.ts`, removed
   along with the React app and **not yet recreated** for the Angular 22 port — the port's
   equivalence rests on its unit specs and a manual pass today).
4. **The provider `bio` is never trusted markup.** It is care-coordinator-authored HTML from an
   unvetted internal tool, and rendering it through a trust-bypass API is the stored-XSS bug this
   app already shipped once. `portal-angular` renders it with `ng-bind-html` + `ngSanitize`;
   `portal-angular-v22` narrows it with `toBioHtml()` and then renders it with `[innerHTML]`
   through Angular's built-in sanitizer. Neither may call `$sce.trustAsHtml` or
   `DomSanitizer.bypassSecurityTrust*` on it, and both have a regression spec that asserts an
   `<img onerror=…>` payload renders inert. `toBioHtml()` exists because a sanitizer allowlist is
   not an image-source policy: both sanitizers keep `img`/`picture`/`source` and neither
   URL-checks `srcset` (CVE-2024-8372, CVE-2024-8373), so a bio could otherwise make a patient's
   browser fetch an attacker-chosen image. It removes markup only — it is a narrower gate in
   front of the sanitizer, never a replacement for it — and `index.html`'s
   `img-src 'self' data:` backs it up in the browser.

## Per-app conventions

**`apps/mock-api`** — ruff with `line-length = 100` (this is enforced and easy to trip; wrap long
lines) and **mypy `strict = true`** over `app/` (tests are not type-checked). Tests are pure
`pytest` against `TestClient`. State persists to `apps/mock-api/data/store.json`, which is
gitignored and reseeded automatically when absent.

`app/observability/` adds JSON logs, Prometheus metrics and OpenTelemetry traces. It is wired so
that **nothing is required to configure**: logs go to stdout and `data/logs/api.log`, traces to
`data/logs/traces.jsonl`, and `GET /metrics` is served **outside** the `/api` prefix so the frozen
contract is untouched. Tracing is off during tests (`OTEL_SDK_DISABLED=true` via pytest-env).
Metric labels use the route **template**, never the concrete path, so appointment ids can never
become label values.

`POST /api/telemetry` is where the frontend's logging/error events land, folded into the same
JSON logs and Prometheus registry (`pulse_frontend_events_total`, labels `source`/`level`, so at
most 6 label combinations ever). Its request schema is deliberately closed (`source`, `level`,
`message`, `route`, `requestId`, `errorCode`; no open-ended context object): the log scrubber
above only guards field *names*, not the *content* of a value it already trusts, so an arbitrary
`context: dict` here would be a way to tunnel free text past that guard. `message` itself is the
one field in that schema that is unavoidably free text on the server side, so the frontend bounds
it *before* it is ever sent: uncaught-exception handlers report `error.name` (a small,
code-controlled value such as `TypeError`, never the exception's `.message`, which could echo
user-entered content) — see the `$exceptionHandler` decorator in AngularJS and
`GlobalErrorHandler` in Angular 22. Each frontend calls the endpoint through a small
`reportEvent`/`checkApiHealth` service rather than posting to it directly — see
`apps/portal-angular/src/app/core/observability/telemetry.service.js` and
`apps/portal-angular-v22/src/app/core/observability/telemetry.service.ts`. It has no *visible* UI
for this (no banner, no status indicator): it's instrumentation only. Note the `source` field is
a closed enum of `angular`/`react`, so events from the AngularJS app (which sends `angularjs`)
are rejected with a 422 that the fire-and-forget caller never sees; the Angular 22 app sends
`angular`.

**`e2e/`** — Playwright, chromium only, its own `package.json`. Runs every user flow against the
one implementation currently in the repo and resets API state around each test. See its
`IMPLEMENTATIONS` fixture for where a second (post-migration) frontend would be added back.

**`apps/portal-angular`** — AngularJS 1.x idioms on purpose: `angular.module` registration,
`.component()` controllers with `$inject`, `$http` promises, `ngRoute`, an `$httpProvider`
interceptor, `ng-bind-html` + `ngSanitize`, webpack (no Angular CLI) and Karma + Jasmine.
Component and directive selectors **must** use the `ph-` prefix; eslint fails otherwise. Do not
modernize this app. Its datedness is the point.

**`apps/portal-angular-v22`** — the opposite brief: current Angular idioms only. Standalone
components (no NgModules), `signal`/`computed` state, zoneless change detection (there is no
`zone.js` dependency at all — don't add one), `inject()` over constructor parameters, `input()`/
`output()`, `@if`/`@for` control flow, a functional `HttpInterceptorFn`, `loadComponent` routes,
`withComponentInputBinding()` for route params, and Vitest + jsdom via `@angular/build:unit-test`.
Component selectors keep the `ph-` prefix (`eslint.config.js`), and styles are co-located per
component with only design tokens and shared primitives left global. File names keep the
`.service.ts`/`.page.ts`/`.component.ts` suffixes rather than the 2025 style guide's shorter form,
so each file lines up with its AngularJS counterpart for as long as both apps are in the repo.

## Gotchas that have cost real time

- **Karma needs a Chrome binary.** `karma.conf.js` resolves one from the puppeteer cache and uses
  a `ChromeHeadlessCI` launcher with `--no-sandbox`. Set `CHROME_BIN` to override. On a bare Linux
  image, Chrome's shared libraries may need installing before specs can run at all. This applies
  to `portal-angular` only: `portal-angular-v22` runs Vitest in jsdom and needs no browser.
- **The Angular 22 CLI has a narrow Node floor.** It requires `^22.22.3 || ^24.15.0 || >=26.0.0`
  and refuses to run (before printing anything about your command) on, say, Node 24.13 or any
  Node 25. `.nvmrc` says `22`, which resolves to a qualifying release; if `ng` exits with
  "requires a minimum Node.js version", the fix is the interpreter, not the workspace.
- **The Python venv stores absolute paths.** Moving or renaming the repo directory breaks it.
  Re-run `npm run setup:api`.
- **`python3` is not necessarily Python 3.12.** macOS still ships 3.9 as `/usr/bin/python3`, and
  `apps/mock-api` requires 3.12+, so a venv built from a bare `python3` fails every dependency
  install with `Could not find a version that satisfies the requirement fastapi==...` — a message
  that never mentions the interpreter. `npm run setup:api` picks the newest qualifying interpreter
  on `PATH` and recreates a venv that was built with an older one; `PYTHON=/path/to/python3`
  overrides the search. CI never sees this, because `setup-python` pins 3.12 there.
- **Seed data ages.** Appointments are seeded relative to the current time, so an untouched store
  drifts from upcoming into past over days. If the app looks wrong, run `npm run reset:data`
  before debugging anything.
- **Restarting the demo server drops any active port-forward.** If someone is viewing the app over
  a forwarded port, restarting `:8080` requires them to restart the forward. Rebuild deliberately,
  not reflexively.
- **`scope` on `GET /api/appointments` accepts `upcoming` or `past` only.** Omit the parameter to
  get everything; there is no `all`.
- **`demo_server.py` serves the SPA from a `/{full_path:path}` catch-all.** Any middleware that
  interprets route templates must handle Starlette's `:path` converter. `str.format` does not — it
  reads `:path` as a format spec and raises `ValueError` — and because the catch-all matches
  everything, a bug there 500s every page and every 404 while leaving `/api` healthy. The unit
  tests exercise `/api` only, so this failure mode is invisible to `npm test`.
- **Killing a process by command-line pattern can kill your own shell.** `pkill -f "uvicorn ... 8098"`
  matches the shell whose argv contains that string. Resolve the listening PID
  (`ss -ltnp | grep ':8098 '`) and kill that instead.

## Definition of done

```bash
npm run lint && npm run typecheck && npm test && npm run build
npm run test:e2e        # required for anything touching rendered output or the demo server
npm run check:duplication && npm run check:doc-freshness
```
