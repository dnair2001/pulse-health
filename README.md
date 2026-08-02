# Pulse Health

Patient portal for a fictional digital healthcare company, kept in **two implementations of the
same feature** so a framework migration can be seen side by side: a legacy Angular 17 NgModule app
and a React port, both driven by one mock HTTP API. The feature is Appointment Scheduling,
complete end to end in both.

The REST contract in [`docs/api-contract.md`](docs/api-contract.md) is frozen. The React port
consumes it byte for byte with no backend change, which is the point: the migration is a frontend
concern only.

## The two frontends

| | Angular 17 (`apps/portal-angular`) | React 19 (`apps/portal-react`) |
| --- | --- | --- |
| Composition | NgModules, `loadChildren` lazy feature module | components, `React.lazy` route split |
| HTTP | `HttpClientModule` + class-based `HttpInterceptor` | `fetch` wrapper + TanStack Query |
| Async | RxJS `switchMap` / `merge` / `takeUntil` | query keys and cache invalidation |
| Forms | Reactive Forms, `ControlValueAccessor` | React Hook Form, controlled component |
| Validation | custom `ValidatorFn` | Zod schema |
| Shared state | `BehaviorSubject` notification service | context provider |
| Tests | Karma + Jasmine | Vitest + React Testing Library |
| Dev server | `ng serve` on :4200 | Vite on :4300 |

Both render the same markup and reuse the same global stylesheet, so the visual output is
identical and the diff is about architecture rather than design.

## Stack

| Layer | Choice | Notes |
| --- | --- | --- |
| Legacy frontend | Angular 17.3, TypeScript 5.4 | NgModules and constructor injection, idiomatic for the era |
| Ported frontend | React 19, Vite 8, TypeScript 6 | TanStack Query, React Hook Form, Zod |
| Styling | one global SCSS stylesheet, shared verbatim | no utility framework |
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
│   ├── portal-react/            React port of the same feature
│   │   ├── vite.config.ts       /api -> localhost:8000, vitest config
│   │   └── src/
│   │       ├── api/             types, fetch client, endpoints, query + mutation hooks
│   │       ├── shared/          badge, spinner, empty state, alert, dialog, formatters
│   │       ├── notifications/   context provider replacing the BehaviorSubject service
│   │       ├── styles/          the Angular stylesheet, reused verbatim
│   │       └── features/appointments/
│   │           ├── AppointmentsRoutes.tsx   lazy-loaded route group
│   │           ├── appointmentSchema.ts     Zod schemas
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
npm run setup   # backend venv + both frontends' dependencies
```

## Root commands

| Command | What it does |
| --- | --- |
| `npm start` | all three: API on :8000, Angular on :4200, React on :4300 |
| `npm run start:api` | uvicorn with reload, http://localhost:8000 (docs at `/docs`) |
| `npm run start:angular` | `ng serve`, http://localhost:4200 |
| `npm run start:react` | `vite`, http://localhost:4300 |
| `npm test` | pytest, then Karma, then Vitest |
| `npm run test:api` / `test:angular` / `test:react` | one suite only |
| `npm run lint` | ruff, then eslint, then oxlint |
| `npm run build` | production build of both frontends |
| `npm run reset:data` | reseed the API store while it is running |

Running `npm start` puts both frontends up at once against the same API, which is the fastest way
to compare them. Both dev servers proxy `/api` to port 8000, so each browser sees one origin and
CORS never applies in development.

### Viewing it from another machine

The dev server binds `0.0.0.0` so it is reachable when the app runs on a remote host or container
and you browse from your own machine over a forwarded port.

Live reload holds a websocket open for the lifetime of the page, and some tunnels handle that
badly: the first page load succeeds and every request after it hangs. If that happens, serve a
compiled bundle over plain HTTP instead of forwarding the dev server.


## Demo script

```bash
npm start
```

Then open http://localhost:4200 for Angular or http://localhost:4300 for React. Both redirect to
`/appointments`, and every step below behaves identically in either one, which is the demo: run
them side by side in two windows against the same API and the same data.

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

328 tests across the three suites.

- **API, 96 tests (pytest).** Every rule and error code, filter and ordering behaviour, the error
  envelope shape for malformed bodies, slot freeing on cancel and swapping on reschedule, and
  persistence across a store reload.
- **Angular, 42 tests (Karma + Jasmine).** Service URLs and query params, the error interceptor's
  normalisation including network failure, the `ControlValueAccessor` slot picker, reactive form
  validation, the pipe and validator, plus component tests for the list page (loading, empty,
  filtered empty, error with retry, cancel confirmation accepted and dismissed, cancel rejection)
  and the schedule page (validation, submission, server error mapping, availability refresh).
- **React, 190 tests (Vitest + React Testing Library).** The fetch client's error normalisation and
  query serialisation, every query and mutation hook including cache invalidation and disabled
  queries, all five shared primitives and both formatters, and the three pages driven through the
  DOM: tab switching, filtering, all three empty states, retry after failure, the cancel
  confirmation flow, form validation, and server-error mapping onto individual fields.

## How the port turned out

The React app is a behaviour-for-behaviour port. What changed, and what deliberately did not:

| Angular | React | Note |
| --- | --- | --- |
| `HttpInterceptor` normalising errors | one `request()` wrapper in `api/client.ts` | same `ApiError` shape, same codes |
| `switchMap` on provider changes | query key `['slots', { providerId }]` | refetching is a cache concern now |
| manual `takeUntil` teardown | none needed | cancellation comes with the query cache |
| `ControlValueAccessor` | controlled component with `value` / `onChange` | ~40 fewer lines, same markup |
| `ValidatorFn` returning `{ required: true }` | Zod schema with `superRefine` | same two messages, same trim rule |
| `BehaviorSubject` notification service | context provider | consumed once on mount, same cross-route banner |

Unchanged on purpose: the markup, the `data-testid` values, the global stylesheet, every user-facing
string, and the API. The stylesheet is literally the same file content, which is what keeps the two
apps pixel-identical.

Two things worth knowing if you extend the port:

- The slot picker groups by the literal date prefix of the ISO timestamp while rendering times in
  local time, carried over from the Angular original. In a non-UTC time zone a slot can land under
  the wrong day heading. It is faithful to the legacy behaviour, and it is a bug in both.
- The React slot picker additionally disables slots with `isBooked: true`. The Angular picker
  ignored that flag, which is unreachable today because the API omits booked slots by default.

## Known constraints

- Python venvs record absolute paths. After moving or renaming this repository, rerun
  `npm run setup:api`.
- Angular 17 prints `Node.js version v22 ... (Unsupported)`. It builds, tests and serves
  correctly; the warning is Angular 17 predating Node 22.
