# Pulse Health

A patient portal demo whose purpose is to show a **legacy Angular app being modernized to
React while behaviour stays identical**. It contains one feature (Appointment Scheduling)
implemented twice against one frozen HTTP contract:

| App | Path | Role |
| --- | --- | --- |
| `mock-api` | `apps/mock-api` | FastAPI, Python 3.12. Owns all business rules and the frozen contract. |
| `portal-angular` | `apps/portal-angular` | Angular 17 with NgModules. The deliberately period-accurate legacy app. **Reference implementation.** |
| `portal-react` | `apps/portal-react` | React 19 + Vite. The migration target. |

The value of this repo is the *equivalence* between the two frontends. Changes that make one
diverge from the other destroy the thing it exists to demonstrate.

## Setup

```bash
npm install          # root tooling (concurrently, prettier)
npm run setup        # python venv, both frontends' node_modules, Playwright chromium
npm run setup:hooks  # optional: install the pre-commit hooks
```

Requires Node 22 (see `.nvmrc`) and Python 3.12+. `.devcontainer/` defines a container with both
toolchains that runs `npm run setup` on create.

## Commands

Always use the root scripts. They exist so nobody has to remember per-app invocations.

| Command | What it does |
| --- | --- |
| `npm start` | All three dev servers: API `:8000`, Angular `:4200`, React `:4300` |
| `npm test` | Unit suite: 121 pytest + 45 Karma + 71 Vitest = **237** |
| `npm run test:e2e` | Builds, then runs the 25 Playwright specs against both frontends |
| `npm run lint` | ruff + Angular eslint + oxlint |
| `npm run typecheck` | mypy (strict) + Angular tsc + React tsc |
| `npm run format` / `format:check` | Prettier over TS/JS/JSON/YAML |
| `npm run build` | Production bundles for both frontends |
| `npm run demo` | Builds, then serves **both** frontends + API on `:8080` |
| `npm run reset:data` | Reseeds the mock API relative to now (needs the API running) |
| `npm run generate:openapi` | Regenerates `apps/mock-api/openapi.json` from the live schema; CI fails if it's stale |

Both frontends proxy `/api` to `localhost:8000`, so the API must be running for either to show
data. Per-app variants exist for tight loops: `test:api`, `test:angular`, `test:react`, and the
same pattern for `lint:`, `typecheck:` and `build:`.

`npm run test:e2e` is deliberately **not** part of `npm test`: it needs a production build first,
and keeping the unit suite fast matters more than a single entry point.

The demo server (`apps/mock-api/demo_server.py`) serves Angular at `/`, React at `/react/`, the
API at `/api`, and a landing page at `/demo`. It reads pre-built bundles, so run `npm run demo`
(which builds first) rather than `demo:serve` alone.

## Hard invariants

Breaking any of these is a defect, not a style preference.

1. **The API contract is frozen.** `docs/api-contract.md` is the specification: camelCase keys,
   UTC ISO-8601 with a `Z` suffix, bare JSON arrays from collection endpoints, one error
   envelope. Do not rename a field, change a status code, or wrap a response. If a frontend
   needs different data, that is a signal to reconsider the frontend.
2. **Business rules live server-side.** Double-booking rejection, cancellation windows, and
   validation are enforced in `apps/mock-api/app/domain/rules.py` and returned as typed error
   codes. Frontends surface those errors; they must not become the source of truth for them. A
   client-side-only guard is a bug because it can be bypassed and it makes the contract dishonest.
3. **The two frontends must render byte-identical user-visible text.** Same labels, same date
   formats, same empty states, same punctuation (including the en dash in time ranges), same
   `<title>`. If you change a string in one app, change it in the other in the same commit. This
   is enforced: `e2e/tests/equivalence.spec.ts` loads both implementations and diffs their
   rendered text, escaping non-ASCII so an en-dash-versus-hyphen regression is unmissable.
4. **Tests must pass in a non-UTC timezone.** Date formatting in React was hand-ported to match
   Angular's `formatDate` output exactly. Run
   `TZ=America/New_York npm run test:react` before claiming green — it has caught real bugs that
   `TZ=UTC` hid.
5. **Angular is the reference.** When the two disagree about behaviour, Angular is right by
   definition and React is the thing to fix.

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

**`e2e/`** — Playwright, chromium only, its own `package.json`. Runs every user flow twice, once
per implementation, and resets API state around each test. It is the only place invariant 3 is
mechanically enforced.

**`apps/portal-angular`** — Angular 17 idioms on purpose: NgModules (not standalone), lazy
`loadChildren`, class-based HTTP interceptor, Reactive Forms, `ControlValueAccessor`. Component and
directive selectors **must** use the `ph-` prefix; eslint fails otherwise. Do not modernize this
app. Its datedness is the point.

**`apps/portal-react`** — React 19, TanStack Query for server state, React Hook Form + Zod for
forms, `oxlint` for linting. `src/styles/global.scss` is copied, not rewritten: its first 413
lines are `apps/portal-angular/src/styles.scss` verbatim and its last 68 are
`apps/portal-angular/src/app/app.component.scss` verbatim (inlined because React has no
component-scoped equivalent here). Keep it that way so visual parity is structural rather than
re-achieved by hand, and port style changes by copying rather than by editing both.
`src/main.tsx` sets `basename={import.meta.env.BASE_URL}` so the app works when served from
`/react/`; do not hardcode a basename.

## Gotchas that have cost real time

- **Karma needs a Chrome binary.** `karma.conf.js` resolves one from the puppeteer cache and uses
  a `ChromeHeadlessCI` launcher with `--no-sandbox`. Set `CHROME_BIN` to override. On a bare Linux
  image, Chrome's shared libraries may need installing before specs can run at all.
- **The Python venv stores absolute paths.** Moving or renaming the repo directory breaks it.
  Re-run `npm run setup:api`.
- **Seed data ages.** Appointments are seeded relative to the current time, so an untouched store
  drifts from upcoming into past over days. If the app looks wrong, run `npm run reset:data`
  before debugging anything.
- **Restarting the demo server drops any active port-forward.** If someone is viewing the app over
  a forwarded port, restarting `:8080` requires them to restart the forward. Rebuild deliberately,
  not reflexively.
- **`scope` on `GET /api/appointments` accepts `upcoming` or `past` only.** Omit the parameter to
  get everything; there is no `all`.
- **`demo_server.py` serves both SPAs from `/{full_path:path}` catch-alls.** Any middleware that
  interprets route templates must handle Starlette's `:path` converter. `str.format` does not — it
  reads `:path` as a format spec and raises `ValueError` — and because the Angular catch-all
  matches everything, a bug there 500s every page and every 404 while leaving `/api` healthy. The
  unit tests exercise `/api` only, so this failure mode is invisible to `npm test`.
- **Killing a process by command-line pattern can kill your own shell.** `pkill -f "uvicorn ... 8098"`
  matches the shell whose argv contains that string. Resolve the listening PID
  (`ss -ltnp | grep ':8098 '`) and kill that instead.

## Definition of done

```bash
npm run lint && npm run typecheck && npm test && npm run build
TZ=America/New_York npm run test:react
npm run test:e2e        # required for anything touching rendered output or the demo server
```

For changes to user-visible strings or date rendering, `test:e2e` is not optional: it is the only
check that compares the two implementations against each other.
