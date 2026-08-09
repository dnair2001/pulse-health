# portal-react

The React port of `apps/portal-angular`, built slice by slice against the frozen contract in
[`docs/api-contract.md`](../../docs/api-contract.md). The Angular app stays in place as the
reference implementation; this app must reproduce its observable behaviour, not reinterpret it.

Ported so far: **Provider Directory** (`/providers`, `/providers/:id`).

## Commands

Use the root scripts (`npm run start:react`, `test:react`, `lint:react`, `typecheck:react`,
`build:react`). Locally, from this directory:

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server on `:4300`, proxying `/api` to `localhost:8000` |
| `npm run test` / `test:ci` | Vitest + React Testing Library, jsdom |
| `npm run lint` | oxlint |
| `npm run typecheck` | `tsc -b` |
| `npm run build` | Typecheck, then the production bundle in `dist/` |

The API must be running for the app to show data. `npm start` at the root brings up the API,
Angular on `:4200` and React on `:4300` together, which is the point: the same data, side by side.

## Layout

```
src/
├── api/          types, fetch wrapper, endpoints, TanStack Query hooks
├── shared/       primitives ported from Angular's shared/components
├── styles/       apps/portal-angular's stylesheet, verbatim, plus its shell block
└── features/
    └── providers/
        ├── ProvidersRoutes.tsx   lazily loaded, so the feature gets its own bundle chunk
        ├── filterProviders.ts    the directory's client-side search
        └── pages/                directory list, provider profile
```

## How Angular patterns map here

| Angular | React |
| --- | --- |
| `loadChildren` lazy feature module | `React.lazy` on `ProvidersRoutes` |
| `HttpClient` service per feature | `api/endpoints.ts` + query hooks in `api/queries.ts` |
| `ApiErrorInterceptor` normalising failures | `toApiError` inside `api/client.ts` |
| `finalize(() => loading = false)` | the query's `isFetching` |
| `[(ngModel)]` on the search box | `useState` + a controlled input |
| route `title` | `useDocumentTitle` |

`data-testid` values, class names and every user-facing string are unchanged, so
`e2e/tests/provider-directory.spec.ts` resolves the same elements in either app.

## Deliberate differences from the Angular app

- **`bio` renders as text, not markup.** Angular pushes it through
  `bypassSecurityTrustHtml` + `[innerHTML]`, which executes whatever HTML a care coordinator
  saved — a stored XSS (DIV-8), and one the seeded `prv_002` payload already demonstrates. JSX
  escapes interpolated text, so nothing here needs sanitising and nothing here should reach for
  `dangerouslySetInnerHTML`. `ProviderProfilePage.test.tsx` pins that with a regression test.
- **The nav lists only ported features**, so `/` lands on the directory rather than the
  dashboard. Each link returns with its slice.

## Not ported yet

`core/observability` (the telemetry service, the `X-Request-Id` header the Angular interceptor
stamps, and the global error handler) and the shared primitives the remaining features use
(`status-badge`, `confirm-dialog`) come with the slices that need them.
