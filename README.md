# Pulse Health

Patient portal for a fictional digital healthcare company, built as a **legacy baseline**: an
Angular 17 NgModule application plus a mock HTTP API. One patient-facing feature is complete
end to end, Appointment Scheduling.

The REST contract in [`docs/api-contract.md`](docs/api-contract.md) is frozen so a future React
frontend can consume the same API without touching the backend.

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
├── package.json                 root commands (dev, test, lint, build)
├── docs/api-contract.md         frozen REST contract
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
│   └── mock-api/                FastAPI mock
│       ├── app/domain/          models, rules, error envelope
│       ├── app/api/             health, providers, visit types, slots, appointments, dev
│       ├── app/store.py         atomic file-backed persistence
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
| `npm start` | API on :8000 and Angular on :4200 together |
| `npm run start:api` | uvicorn with reload, http://localhost:8000 (docs at `/docs`) |
| `npm run start:web` | `ng serve`, http://localhost:4200 |
| `npm test` | pytest then Karma (96 + 42 tests) |
| `npm run test:api` / `npm run test:web` | one side only |
| `npm run lint` | ruff then eslint |
| `npm run build` | production Angular build |
| `npm run reset:data` | reseed the API store while it is running |

The Angular dev server proxies `/api` to the API, so the browser sees one origin and CORS does
not apply in development.

### Viewing it from another machine

The dev server binds `0.0.0.0` so it is reachable when the app runs on a remote host or container
and you browse from your own machine over a forwarded port.

Live reload holds a websocket open for the lifetime of the page, and some tunnels handle that
badly: the first page load succeeds and every request after it hangs. If that happens, serve a
compiled bundle over plain HTTP instead of forwarding the dev server.</new_str>


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

- **API, 96 tests.** Every rule and error code, filter and ordering behaviour, the error envelope
  shape for malformed bodies, slot freeing on cancel and swapping on reschedule, and persistence
  across a store reload.
- **Angular, 42 tests.** Service URLs and query params, the error interceptor's normalisation
  including network failure, the `ControlValueAccessor` slot picker, reactive form validation,
  the pipe and validator, plus component tests for the list page (loading, empty, filtered
  empty, error with retry, cancel confirmation accepted and dismissed, cancel rejection) and the
  schedule page (validation, submission, server error mapping, availability refresh).

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
