# portal-react

React 19 + Vite + TypeScript app that the Angular patient portal is being migrated into,
one feature slice at a time. See the root `README.md` for the monorepo layout, the commands,
and the frozen API contract in `docs/api-contract.md`.

## State of this branch

This is the starting point for a migration slice: the shell exists, nothing is ported yet.

Already in place, so a slice never has to redo it:

| Piece | Where |
| --- | --- |
| Vite + TypeScript config, dev-server proxy to the API on `:8000` | `vite.config.ts`, `tsconfig*.json` |
| Vitest + Testing Library setup and provider harness | `src/test/setup.ts`, `src/test/helpers.tsx` |
| Notification (toast) provider | `src/notifications/NotificationProvider.tsx` |
| Global stylesheet, byte-identical to the Angular one so ported markup needs no new CSS | `src/styles/global.scss` |
| Entry point with QueryClient, Router and Notification providers wired | `src/main.tsx` |

Not here, because it belongs to the slice being ported:

- the app shell (`App.tsx`), route tree, and any feature directory
- the typed API client and query hooks
- the shared presentational primitives

## Commands

Run from the repo root:

```bash
npm run start:react     # dev server on :4300, proxying /api to :8000
npm run test:react      # vitest
npm run build:react     # production bundle
npm run lint:react      # oxlint
```
