# End-to-end suite

Browser-level tests that drive the **real** Angular bundle in Chromium against the **real** mock
API. The unit suite (`npm test` at the root) stubs HTTP; nothing here does.

## How it works

`apps/mock-api/demo_server.py` serves Angular at `/` and the API at `/api` from one port, so one
run can exercise the frontend against a live backend with no CORS. Playwright starts that server
itself via `webServer`.

Every user-flow spec is parameterised over `IMPLEMENTATIONS` in `tests/support/fixtures.ts`. It
holds a single entry today; the loop stays in place so a second implementation — the eventual
React port — can be added back by extending that array instead of rewriting every spec.

## Running it

Build the bundle first — the demo server reads compiled output and refuses to start without it:

```bash
npm run demo:build          # from the repo root
```

Then:

```bash
cd e2e
npm install                 # once
npx playwright install chromium   # once; downloads the browser
npx playwright test
```

Takes about 15 seconds.

### One spec, one test

```bash
npx playwright test tests/schedule.spec.ts
npx playwright test -g "cancelling an appointment"
```

### Debugging

```bash
npx playwright test --headed            # watch it happen
npx playwright test --ui                # time-travel runner, best first stop
npx playwright test --debug -g "books"  # step through with the inspector
npx playwright show-report              # open the HTML report of the last run
```

On a failure Playwright writes `test-results/<test>/error-context.md` with the accessibility
snapshot at the moment of failure. For a retried failure it also writes a trace; open it with
`npx playwright show-trace test-results/<test>/trace.zip`.

### Ports

Defaults to `http://127.0.0.1:8099`. Port 8080 is deliberately avoided: that is where the
long-lived `npm run demo` instance lives, and restarting it drops anyone's port-forward.

```bash
E2E_PORT=9123 npx playwright test              # start the server on another port
E2E_BASE_URL=http://127.0.0.1:8080 npx playwright test   # use a server you already run
```

`E2E_BASE_URL` disables `webServer` entirely, so nothing is started or stopped.

## Determinism

- `POST /api/dev/reset` runs before **and** after every test (the `freshState` auto fixture), so
  specs are order-independent and a failed run does not poison the next one.
- Expectations are read from the API, never hardcoded. Seed appointments are generated relative
  to now, so any literal date would rot within a day.
- `workers: 1`. All specs mutate one shared `store.json`; parallel workers would see each other's
  bookings.
- No `waitForTimeout`. Waits are web-first assertions and locator waits. Helpers in
  `tests/support/pages.ts` always wait for a *positive* signal (a card, an empty state, a
  populated `<select>`) before asserting a spinner is gone, because "no spinner" is also true in
  the gap before the app's first paint.

## Layout

| Path | What it covers |
| --- | --- |
| `tests/appointment-list.spec.ts` | List, tabs, filters, empty state, cancel flow |
| `tests/schedule.spec.ts` | Booking a slot end to end, and form validation |
| `tests/server-authoritative.spec.ts` | A double-booking rejected by the server surfaces in the UI |
| `tests/support/api.ts` | Typed client for the frozen contract; source of expected values |
| `tests/support/pages.ts` | Locators and settled-state helpers shared by the specs |
| `tests/support/fixtures.ts` | `IMPLEMENTATIONS` list and the shared `freshState` fixture |

## Conventions

- Locate by `data-testid` wherever the app provides one.
- Normalise whitespace only where a spec compares rendered text. Casing, punctuation and date
  formatting are left alone — they are exactly what a regression there would change.
