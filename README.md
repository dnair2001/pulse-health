# Pulse Health

Patient portal for a fictional digital healthcare company, used to show a legacy frontend being
modernised. One patient-facing feature, Appointment Scheduling, is complete end to end in **two
frontends** against **one backend**:

| App | What it is |
| --- | --- |
| `apps/portal-angular` | the legacy baseline: Angular 17 NgModules, RxJS, Karma |
| `apps/portal-react` | the migration target: React 19, Vite, TanStack Query, Vitest |
| `apps/mock-api` | FastAPI mock, shared by both, unchanged by the migration |

The REST contract in [`docs/api-contract.md`](docs/api-contract.md) is frozen, which is what let
the React port land without a single backend change. Both frontends render the same markup, reuse
the same stylesheet and keep the same `data-testid` values, so their output is byte-identical.

## Stack

| Layer | Choice | Why it looks like this |
| --- | --- | --- |
| Frontend | Angular 17.3, TypeScript 5.4 | NgModules, `HttpClientModule` and constructor injection are idiomatic here, not retrofitted |
| Routing | Root module + lazy-loaded feature module | `appointments` ships as its own bundle |
| Forms | Angular Reactive Forms | including a `ControlValueAccessor` slot picker |
| Async | RxJS 7 observables | `switchMap`, `merge`, `takeUntil` teardown |
| Styling | Component SCSS + global stylesheet | no utility framework |
| Tests | Karma + Jasmine | the default runner for this Angular era |
| API | FastAPI 0.141, Python 3.12 | file-backed JSON store, seeded relative to "now" |
| API tests | pytest | rules enforced and asserted server-side |

## Layout

```
pulse-health/
├── package.json                 root commands (dev, test, lint, typecheck, build, demo)
├── AGENTS.md                    invariants and conventions for agents and newcomers
├── docs/api-contract.md         frozen REST contract
├── .github/workflows/           CI per app, secret scan, nightly flaky-test detection
├── .devcontainer/               Node 22 + Python 3.12, runs npm run setup on create
├── .pre-commit-config.yaml      ruff, mypy, oxlint, eslint, prettier, hygiene hooks
├── e2e/                         Playwright specs driving both frontends on one port
├── apps/
│   ├── portal-angular/          Angular 17 patient portal
│   │   ├── karma.conf.js        headless Chrome, resolved from the puppeteer cache
│   │   ├── proxy.conf.json      /api -> localhost:8000
│   │   └── src/app/
│   │       ├── core/            models, HTTP error interceptor, notification service
│   │       ├── shared/          badge, spinner, empty state, alert, confirm dialog, pipe, validator
│   │       └── features/appointments/
│   │           ├── appointments.module.ts + appointments-routing.module.ts
│   │           ├── services/    appointments, providers, slots (HttpClient)
│   │           ├── pages/       list, schedule, reschedule
│   │           └── components/  appointment card, filters, slot picker
│   ├── portal-react/            React 19 port of the same feature
│   │   ├── vite.config.ts       /api -> localhost:8000, dev server on :4300
│   │   └── src/
│   │       ├── api/             typed client, endpoints, query hooks, error normalisation
│   │       ├── shared/          the same five primitives, date helpers, visit-type label
│   │       ├── notifications/   notification provider
│   │       └── features/appointments/
│   │           ├── AppointmentsRoutes.tsx + appointmentSchema.ts
│   │           ├── pages/       list, schedule, reschedule
│   │           └── components/  appointment card, filters, slot picker
│   └── mock-api/                FastAPI mock
│       ├── app/domain/          models, rules, error envelope
│       ├── app/api/             health, providers, visit types, slots, appointments, dev
│       ├── app/observability/   JSON logs, Prometheus /metrics, OpenTelemetry traces
│       ├── app/store.py         atomic file-backed persistence
│       ├── demo_server.py       both built frontends + the API on one port
│       └── data/store.json      runtime state (gitignored, reseeds when missing)
```

## Prerequisites

- Node.js 22+ and npm
- Python 3.12+ with `python3-venv`
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
npm run setup   # backend venv + Angular dependencies
```

## Root commands

| Command | What it does |
| --- | --- |
| `npm start` | all three: API on :8000, Angular on :4200, React on :4300 |
| `npm run start:api` | uvicorn with reload, http://localhost:8000 (docs at `/docs`) |
| `npm run start:angular` | `ng serve`, http://localhost:4200 |
| `npm run start:react` | `vite`, http://localhost:4300 |
| `npm test` | all three unit suites (133 + 63 + 83 = 279 tests) |
| `npm run test:api` / `test:angular` / `test:react` | one suite only |
| `npm run test:e2e` | 25 Playwright specs driving both frontends in a real browser |
| `npm run lint` | ruff, then eslint, then oxlint |
| `npm run typecheck` | mypy (strict), then Angular tsc, then React tsc |
| `npm run format` | Prettier over TS/JS/JSON/YAML |
| `npm run build` | production bundles for both frontends |
| `npm run demo` | build both frontends and serve them with the API on one port |
| `npm run reset:data` | reseed the API store while it is running |

Both dev servers proxy `/api` to the API, so the browser sees one origin and CORS does not apply
in development.

### Viewing both apps from another machine

When the repo runs on a remote host or container and you browse from your own machine, use:

```bash
npm run start:api    # in one shell, if it is not already running
npm run demo         # in another: builds both bundles, serves on :8080
```

Forward the single port (`8080`) and open:

| URL | App |
| --- | --- |
| http://localhost:8080/appointments | Angular |
| http://localhost:8080/react/appointments | React |

One port means one tunnel, and both apps share the same API and store, so a booking made in one
shows up in the other on refresh.

Prefer this over forwarding the dev servers. Live reload holds a websocket open for the lifetime
of the page and some tunnels handle that badly: the first page load succeeds and every request
after it hangs. `npm run demo` serves compiled bundles over plain HTTP, so every connection is
short-lived. It also has no file watcher, so rerun `npm run demo:build` after changing code.

## Demo script

```bash
npm start
```

Then open http://localhost:4200, which redirects to `/appointments`.

1. **Upcoming and past.** The Upcoming tab lists three seeded appointments. Switch to Past for a
   completed and a cancelled visit. Note that completed visits show *"Completed visits cannot be
   cancelled"* and expose no action buttons.
2. **Filtering.** Filter by status and visit type. Combine with the tabs, then use *Clear
   filters*. Filtering with no matches shows a distinct empty state.
3. **Providers and availability.** Click *Schedule appointment* and pick a provider. Time slots
   load for that provider only, grouped by day. Booked and past slots are never offered.
4. **Validation.** Submit the empty form: the reason, slot, provider and visit type errors all
   appear. A reason of only spaces is still rejected, client and server side.
5. **Scheduling.** Complete the form and confirm. You land back on the list with a success banner
   and the new appointment in place.
6. **Persistence.** Reload the browser. The appointment is still there, because the API writes
   `apps/mock-api/data/store.json` on every mutation and reloads it on boot.
7. **Rescheduling.** Choose *Reschedule* on a scheduled appointment, pick a new time, confirm.
   The old slot is released and the new one booked in one step.
8. **Cancelling.** Choose *Cancel*. Nothing happens until you accept the confirmation dialog.
9. **API error state.** Stop the API (`Ctrl+C` in the `api` pane) and reload the list. You get
   *"Cannot reach the Pulse Health API"* plus a *Try again* button that recovers once it is back.
10. **Double booking.** With the schedule form open on a chosen slot, book that same slot from
    another terminal, then submit the form:

    ```bash
    SLOT=$(curl -s 'http://localhost:8000/api/slots?providerId=prv_001' | jq -r '.[0].id')
    curl -s -X POST http://localhost:8000/api/appointments -H 'content-type: application/json' \
      -d "{\"providerId\":\"prv_001\",\"slotId\":\"$SLOT\",\"visitType\":\"video\",\"reason\":\"Race the UI\"}"
    ```

    The form reports *"That time slot has just been taken"*, marks the slot field, and reloads
    availability instead of silently failing.
11. **No past bookings.** The UI never offers a past slot, and the rule is enforced server-side:

    ```bash
    curl -s -X POST http://localhost:8000/api/appointments -H 'content-type: application/json' \
      -d '{"providerId":"prv_001","slotId":"slt_prv_001_20200101T0900","visitType":"video","reason":"Time travel"}'
    ```

12. **Back to a clean slate.** `npm run reset:data` reseeds providers, slots and appointments
    relative to the current time.

## Business rules

Enforced in the API and surfaced in the UI:

| Rule | Where | Failure surfaced as |
| --- | --- | --- |
| No booking in the past | `app/domain/rules.py` | `SLOT_IN_PAST` (422) |
| A slot cannot be booked twice | `app/domain/rules.py` | `SLOT_ALREADY_BOOKED` (409) |
| A reason is required | API + `trimmedRequired` validator | `VALIDATION_ERROR` (422) |
| Completed appointments cannot be cancelled | `app/domain/rules.py` | `APPOINTMENT_NOT_CANCELLABLE` (409) |
| Scheduled appointments cancel after confirmation | `ConfirmDialogComponent` | dialog gate, then 200 |
| Appointments survive a refresh | `app/store.py` | state reloaded from disk |

## Tests

```bash
npm test
```

- **API, 133 tests.** Every rule and error code, filter and ordering behaviour, the error envelope
  shape for malformed bodies, slot freeing on cancel and swapping on reschedule, and persistence
  across a store reload. Plus observability: correlation ids, metric label cardinality, the JSON
  log line's shape, the log scrubber's allowlist, and POST /api/telemetry's validation and
  logging/metrics fan-out, and two tests that pin the `/api` payload and error-envelope shapes so
  the frozen contract cannot drift.
- **React, 83 tests.** The same ground as the Angular suite in the React idiom: the client's error
  normalisation and query-string building (plus the `X-Request-Id` header, the query retry
  predicate, and reporting failures to `/api/telemetry`), query-key isolation and cache
  invalidation, the shared primitives and date helpers, the three components, and the three pages
  including the orderings that keep a page banner and a field-level server error from
  disagreeing. Green under any `TZ`.
- **Angular, 63 tests.** Service URLs and query params, the error interceptor's normalisation
  including network failure, the `X-Request-Id` header it stamps, and reporting failures to
  `/api/telemetry`, the global `ErrorHandler`, the `ControlValueAccessor` slot picker, reactive
  form validation, the pipe and validator, plus component tests for the list page (loading, empty,
  filtered empty, error with retry, cancel confirmation accepted and dismissed, cancel rejection)
  and the schedule page (validation, submission, server error mapping, availability refresh).

```bash
npm run test:e2e
```

- **End to end, 25 specs.** Every user flow runs twice, once per implementation, against one live
  API on one port. Five of them load the Angular page and the React page and diff their rendered
  text, which is the only mechanical enforcement of the claim that the two frontends are
  interchangeable. Non-ASCII characters are escaped in the failure output so an en-dash-versus-hyphen
  regression cannot slip through as a visually identical diff.

## Notes for the migration phase

- The API is the contract. A React port should reuse `docs/api-contract.md` verbatim; no backend
  change is required.
- Deliberately legacy patterns a rewrite will have to address: NgModules and lazy `loadChildren`,
  `HttpClientModule` with a class-based `HttpInterceptor`, RxJS pipelines with manual
  `takeUntil` teardown, `ControlValueAccessor` form integration, template-driven `*ngIf`/`*ngFor`
  rendering, and a `BehaviorSubject` notification service standing in for shared state.
- `data-testid` attributes are already in place on the elements a UI test would target, so
  behavioural tests can be ported alongside the components.

## Known constraints

- Python venvs record absolute paths. After moving or renaming this repository, rerun
  `npm run setup:api`.
- Angular 17 prints `Node.js version v22 ... (Unsupported)`. It builds, tests and serves
  correctly; the warning is Angular 17 predating Node 22.
