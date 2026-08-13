# Contributing

Read [AGENTS.md](AGENTS.md) first. It is the authoritative description of this repo's commands,
invariants, per-app conventions, and the gotchas that have already cost people time. This file
is only the short version.

## Setup

Requires Node 22+ and Python 3.12+. A `.devcontainer/devcontainer.json` is provided if you'd
rather build in a container than install these locally. `npm run setup` searches `PATH` for an
interpreter that meets the Python floor instead of assuming `python3` is one, so it also works on
machines whose `python3` is older (macOS still ships 3.9).

```bash
npm install     # root tooling
npm run setup   # python venv + Angular node_modules
```

## Commands

Always use the root scripts rather than per-app invocations.

| Command | What it does |
| --- | --- |
| `npm start` | All three dev servers: API `:8000`, AngularJS `:4200`, Angular 22 `:4201` |
| `npm test` | Full suite: 170 pytest + 12 Karma + 22 Vitest = 204 |
| `npm run lint` | ruff + eslint for both frontends (includes a complexity budget — see AGENTS.md) |
| `npm run build` | Production bundle for both frontends |
| `npm run demo` | Builds, then serves the AngularJS frontend + API on `:8080` |
| `npm run reset:data` | Reseeds the mock API relative to now (API must be running) |
| `npm run check:duplication` | jscpd duplicate-code budget across all three source trees |
| `npm run check:doc-freshness` | Confirms the test counts documented in AGENTS.md/README.md/CONTRIBUTING.md/the PR template still match the live suites |

Per-app variants exist for tight loops: `test:api`, `test:angular` (AngularJS),
`test:angular-v22` (the Angular 22 port), and the same pattern for `lint:` and `build:`.
Dead-code/unused-dependency checks run per app too: `knip`
(`npm run lint:deadcode` in `apps/portal-angular`) and, for mock-api, `vulture` + `pip-extra-reqs`
(run directly via its venv — see AGENTS.md).

The frontend proxies `/api` to `localhost:8000`, so the API must be running to show data.

## The invariants

These are defects when broken, not style preferences. Full text in
[AGENTS.md](AGENTS.md#hard-invariants).

1. The API contract in [`docs/api-contract.md`](docs/api-contract.md) is **frozen**.
2. Business rules live server-side in `apps/mock-api/app/domain/rules.py`.
3. `apps/portal-angular` is deliberately legacy and is the reference implementation for the
   migration. Do not modernize it — `apps/portal-angular-v22` is where the modern Angular
   version of the same feature lives.

## Before you open a PR

```bash
npm run lint && npm test && npm run build
npm run typecheck && npm run format:check
npm run check:duplication && npm run check:doc-freshness
```

All of these must pass. For changes to user-visible strings or date rendering, also run
`npm run test:e2e`, which is the only check that renders the app in a real browser.

CI runs the same commands as separate per-app jobs. The pull request template's checklist
mirrors this list — fill it in honestly.

## Reporting problems

Bugs and feature requests go through the [issue forms](https://github.com/dnair2001/pulse-health/issues/new/choose).
Security problems go through [SECURITY.md](SECURITY.md), not a public issue.
