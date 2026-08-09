# Pulse Health

Patient portal for a fictional digital healthcare company, used to show a legacy Angular
frontend being modernised. A dashboard plus five patient-facing features are complete end to
end: Appointment Scheduling, Provider Directory, Patient Profile & Demographics, Prescriptions &
Medications, and Billing & Insurance Claims.

| App | What it is |
| --- | --- |
| `apps/portal-angular` | the legacy baseline: Angular 17 NgModules, RxJS, Karma |
| `apps/portal-react` | the in-progress React 19 port, one feature slice at a time |
| `apps/mock-api` | FastAPI mock backing both |

The REST contract in [`docs/api-contract.md`](docs/api-contract.md) is frozen — it is written so
that migrating to another frontend framework requires no backend change, and the React port
consumes it unchanged. `data-testid` attributes are in place on the elements a UI test would
target, so behavioural tests port alongside the components.

The React app currently covers **Provider Directory** only; the Angular app remains the complete
reference implementation. See [`apps/portal-react/README.md`](apps/portal-react/README.md) for
what is ported, how each Angular pattern maps, and where the two apps differ on purpose.

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
├── docs/privacy.md              what happens to data in this demo (no real PHI)
├── .jscpd.json                  duplicate-code budget across both apps
├── .github/workflows/           CI per app, CodeQL, secret scan, flaky-test detection
├── .devcontainer/               Node 22 + Python 3.12, runs npm run setup on create
├── .pre-commit-config.yaml      ruff, mypy, vulture, eslint, knip, jscpd, prettier, hygiene hooks
├── e2e/                         Playwright specs driving the frontend on one port
├── apps/
│   ├── portal-angular/          Angular 17 patient portal
│   │   ├── karma.conf.js        headless Chrome, resolved from the puppeteer cache
│   │   ├── proxy.conf.json      /api -> localhost:8000
│   │   └── src/app/
│   │       ├── core/            models, HTTP error interceptor, notification service
│   │       ├── shared/          badge, spinner, empty state, alert, confirm dialog, pipe, validator
│   │       └── features/
│   │           ├── dashboard/       landing page summarising the other five features
│   │           ├── appointments/    scheduling, rescheduling, cancelling
│   │           ├── providers/       provider directory + profile pages
│   │           ├── patient-profile/ demographics, contact-info edit, identity verification
│   │           ├── prescriptions/   list, filter, refill request
│   │           └── billing/         invoices, payments
│   ├── portal-react/            React 19 port (Vite, TanStack Query, Vitest)
│   │   ├── vite.config.ts       :4300, /api -> localhost:8000, Vitest config
│   │   └── src/
│   │       ├── api/             types, fetch wrapper, endpoints, query hooks
│   │       ├── shared/          primitives ported from Angular's shared/components
│   │       ├── styles/          the Angular stylesheet, verbatim
│   │       └── features/
│   │           └── providers/       provider directory + profile pages
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
npm run setup   # backend venv + both frontends' dependencies
```

## Root commands

| Command | What it does |
| --- | --- |
| `npm start` | all three: API on :8000, Angular on :4200, React on :4300 |
| `npm run start:api` | uvicorn with reload, http://localhost:8000 (docs at `/docs`) |
| `npm run start:angular` | `ng serve`, http://localhost:4200 |
| `npm run start:react` | `vite`, http://localhost:4300 |
| `npm test` | every unit suite (170 + 106 = 276 tests, plus the React suite) |
| `npm run test:api` / `test:angular` / `test:react` | one suite only |
| `npm run test:e2e` | Playwright specs driving the Angular frontend in a real browser |
| `npm run lint` | ruff, then eslint, then oxlint |
| `npm run typecheck` | mypy (strict), then Angular tsc, then React tsc |
| `npm run format` | Prettier over TS/JS/JSON/YAML |
| `npm run build` | production bundles for both frontends |
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

Then open http://localhost:4200, which lands on the Dashboard: a summary of the next
appointment, active prescriptions, the outstanding billing balance, and quick links into each
feature below.

### Appointments

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

### Provider Directory

1. **Browse and search.** `/providers` lists all four providers; the search box filters by name
   or specialty client-side.
2. **Profile.** Click a provider to see their full bio alongside their credentials and location.
   An unknown id in the URL shows a not-found error instead of a blank page.

### Patient Profile & Demographics

1. **Demographics on file.** `/profile` shows the one seeded patient's contact and emergency
   information. The SSN is shown as its last four digits only; the full value never leaves the
   API in this view.
2. **Editing.** *Edit* switches the read view to a reactive form. Name, date of birth, and SSN
   are not editable — only contact and emergency-contact fields are. Server-side validation
   errors (bad email/phone format, blank required fields) map onto the specific field.
3. **Identity verification.** The insurance-card widget asks for the SSN and date of birth again
   and calls a separate verification endpoint; a mismatch is rejected without exposing why.

### Prescriptions & Medications

1. **Active and completed.** `/prescriptions` tabs between All, Active and Completed. Each card
   shows dosage, frequency and instructions.
2. **Refills.** *Request refill* is disabled with an inline reason once a prescription is
   completed, cancelled, or has no refills left; otherwise it decrements the remaining count.

### Billing & Insurance Claims

1. **What insurance covered.** `/billing` tabs between All, Open and Paid. Each invoice shows
   what was billed, what insurance paid, and the resulting patient responsibility and balance,
   computed on every read rather than stored.
2. **Overdue.** An open invoice past its due date carries an *overdue* badge.
3. **Paying a balance.** *Pay balance* opens an inline form pre-filled with the remaining
   balance. A payment that exactly clears it marks the invoice paid; a partial payment reduces
   the balance and leaves it open. Overpaying is rejected with the current balance quoted back.

## Business rules

Enforced in the API and surfaced in the UI. The appointment rules below were the first written;
the full set for every feature, including Provider Directory, Patient Profile, Prescriptions and
Billing, is enumerated in [`docs/api-contract.md`](docs/api-contract.md#business-rules).

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

- **API, 170 tests.** Every rule and error code, filter and ordering behaviour, the error envelope
  shape for malformed bodies, slot freeing on cancel and swapping on reschedule, and persistence
  across a store reload, across all five domains (appointments, providers, patients,
  prescriptions, billing). Plus observability: correlation ids, metric label cardinality, the
  JSON log line's shape, the log scrubber's allowlist, and POST /api/telemetry's validation and
  logging/metrics fan-out, and two tests that pin the `/api` payload and error-envelope shapes so
  the frozen contract cannot drift.
- **Angular, 106 tests.** Service URLs and query params, the error interceptor's normalisation
  including network failure, the `X-Request-Id` header it stamps, and reporting failures to
  `/api/telemetry` bounded to `error.name`, the global `ErrorHandler`, the `ControlValueAccessor`
  slot picker, reactive form validation, the pipe and validator, plus component tests for every
  feature page: appointments (list, schedule, reschedule), the provider directory and profile,
  patient profile (edit, identity verification), prescriptions (tabs, refill), billing (tabs,
  payment), and the dashboard's cross-feature summary.
- **React, 49 tests (Vitest + React Testing Library).** The fetch wrapper's error normalisation
  and the endpoints' URLs, the query hooks including the disabled-without-an-id case, the shared
  primitives, the app shell's redirects, and both provider pages driven through the DOM: loading,
  populated, search by name and by specialty, both empty states, retry after a network failure,
  server error, not-found, and a regression test asserting a script-bearing `bio` renders as
  inert text.

```bash
npm run test:e2e
```

- **End to end, 27 specs.** Every user flow against one live API on one port, across all five
  features plus the dashboard: listing, filtering, cancelling, scheduling, form validation, the
  server-authoritative double-booking rejection, provider search and profiles, patient
  demographics and identity verification, prescription refills, and invoice payments.

## Notes for the migration phase

- The API is the contract. The React port reuses `docs/api-contract.md` verbatim; no backend
  change is required, and a slice that seems to need one has been ported wrong.
- One feature slice at a time, in `apps/portal-react`. The Angular app stays in place as the
  reference implementation and the before/after comparison; it is not deleted or refactored.
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
