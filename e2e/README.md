# End-to-end suite

Browser-level tests that drive the **real** Angular and React bundles in Chromium against the
**real** mock API. The unit suites (`npm test` at the root) stub HTTP; nothing here does.

The suite exists mainly to make AGENTS.md invariant 3 mechanical: `tests/equivalence.spec.ts`
loads each route twice — once from the Angular bundle, once from the React bundle — and diffs the
rendered text of `main.shell__main`. Previously that check was somebody comparing two browser
windows by eye.

## How it works

`apps/mock-api/demo_server.py` serves Angular at `/`, React at `/react/`, and the API at `/api`
from one port, so one run can exercise both frontends against one backend. Playwright starts that
server itself via `webServer`.

Every user-flow spec is parameterised over both implementations (`IMPLEMENTATIONS` in
`tests/support/fixtures.ts`), so a flow that works in only one app fails.

## Running it

Build the bundles first — the demo server reads compiled output and refuses to start without it:

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

Takes about 20 seconds.

### One spec, one test

```bash
npx playwright test tests/equivalence.spec.ts
npx playwright test -g "cancelling an appointment"
npx playwright test -g "^react: "        # only the React half of the flows
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
| `tests/equivalence.spec.ts` | Angular vs. React rendered text and `data-testid` sets, per route |
| `tests/appointment-list.spec.ts` | List, tabs, filters, empty state, cancel flow |
| `tests/schedule.spec.ts` | Booking a slot end to end, and form validation |
| `tests/server-authoritative.spec.ts` | A double-booking rejected by the server surfaces in the UI |
| `tests/support/api.ts` | Typed client for the frozen contract; source of expected values |
| `tests/support/pages.ts` | Locators and settled-state helpers shared by the specs |
| `tests/support/text.ts` | Whitespace normalisation and the diff shown on an equivalence failure |

## Conventions

- Locate by `data-testid` wherever the apps provide one. Both apps carry the same set on purpose,
  and `equivalence.spec.ts` asserts that; a testid in one app and not the other is a defect worth
  reporting rather than working around.
- Normalise whitespace only. Casing, punctuation and date formatting are the things the
  equivalence check exists to catch — collapsing them away would make the suite lie.
