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
npm install          # root tooling (concurrently)
npm run setup        # python venv + both frontends' node_modules
```

Requires Node 22+ and Python 3.12+. There is no devcontainer; the environment is set up by
`npm run setup` alone.

## Commands

Always use the root scripts. They exist so nobody has to remember per-app invocations.

| Command | What it does |
| --- | --- |
| `npm start` | All three dev servers: API `:8000`, Angular `:4200`, React `:4300` |
| `npm test` | Full suite: 96 pytest + 42 Karma + 62 Vitest = **200** |
| `npm run lint` | ruff + Angular eslint + oxlint |
| `npm run build` | Production bundles for both frontends |
| `npm run demo` | Builds, then serves **both** frontends + API on `:8080` |
| `npm run reset:data` | Reseeds the mock API relative to now (needs the API running) |

Both frontends proxy `/api` to `localhost:8000`, so the API must be running for either to show
data. Per-app variants exist for tight loops: `test:api`, `test:angular`, `test:react`, and the
same pattern for `lint:` and `build:`.

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
   formats, same empty states, same punctuation (including the en dash in time ranges). If you
   change a string in one app, change it in the other in the same commit. This is verifiable:
   build both, serve with `npm run demo`, and diff the rendered text of `/appointments` against
   `/react/appointments`.
4. **Tests must pass in a non-UTC timezone.** Date formatting in React was hand-ported to match
   Angular's `formatDate` output exactly. Run
   `TZ=America/New_York npm run test:react` before claiming green — it has caught real bugs that
   `TZ=UTC` hid.
5. **Angular is the reference.** When the two disagree about behaviour, Angular is right by
   definition and React is the thing to fix.

## Per-app conventions

**`apps/mock-api`** — ruff with `line-length = 100` (this is enforced and easy to trip; wrap long
lines). Tests are pure `pytest` against `TestClient`. State persists to
`apps/mock-api/data/store.json`, which is gitignored and reseeded automatically when absent.

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

## Definition of done

```bash
npm run lint && npm test && npm run build
TZ=America/New_York npm run test:react
```

All four must pass. For changes to user-visible strings or date rendering, also verify invariant 3
by rendering both apps rather than trusting tests.
