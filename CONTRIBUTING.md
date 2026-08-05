# Contributing

Read [AGENTS.md](AGENTS.md) first. It is the authoritative description of this repo's commands,
invariants, per-app conventions, and the gotchas that have already cost people time. This file
is only the short version.

## Setup

Requires Node 22+ and Python 3.12+. There is no devcontainer.

```bash
npm install     # root tooling
npm run setup   # python venv + both frontends' node_modules
```

## Commands

Always use the root scripts rather than per-app invocations.

| Command | What it does |
| --- | --- |
| `npm start` | All three dev servers: API `:8000`, Angular `:4200`, React `:4300` |
| `npm test` | Full suite: 96 pytest + 42 Karma + 62 Vitest = 200 |
| `npm run lint` | ruff + Angular eslint + oxlint |
| `npm run build` | Production bundles for both frontends |
| `npm run demo` | Builds, then serves both frontends + API on `:8080` |
| `npm run reset:data` | Reseeds the mock API relative to now (API must be running) |

Per-app variants exist for tight loops: `test:api`, `test:angular`, `test:react`, and the same
pattern for `lint:` and `build:`.

Both frontends proxy `/api` to `localhost:8000`, so the API must be running for either to show
data.

## The invariants

These are defects when broken, not style preferences. Full text in
[AGENTS.md](AGENTS.md#hard-invariants).

1. The API contract in [`docs/api-contract.md`](docs/api-contract.md) is **frozen**.
2. Business rules live server-side in `apps/mock-api/app/domain/rules.py`.
3. The two frontends must render **byte-identical** user-visible text.
4. Tests must pass in a non-UTC timezone.
5. Angular is the reference implementation; React is the thing to fix.

`apps/portal-angular` is deliberately period-accurate Angular 17. Do not modernize it.

## Before you open a PR

```bash
npm run lint && npm test && npm run build
TZ=America/New_York npm run test:react
npm run typecheck && npm run format:check
```

All of these must pass. For changes to user-visible strings or date rendering, also verify
invariant 3 by rendering both apps (`npm run demo`, then diff the text of `/appointments`
against `/react/appointments`) rather than trusting tests.

CI runs the same commands as separate per-app jobs, and runs the React suite under both `UTC`
and `America/New_York`. The pull request template's checklist mirrors this list — fill it in
honestly.

## Reporting problems

Bugs and feature requests go through the [issue forms](https://github.com/dnair2001/pulse-health/issues/new/choose).
Security problems go through [SECURITY.md](SECURITY.md), not a public issue.
