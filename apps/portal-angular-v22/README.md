# portal-angular-v22

The Pulse Health patient portal on **Angular 22**: standalone components, signals, zoneless
change detection, a functional HTTP interceptor, lazily loaded routes and Vitest.

It is a port of `apps/portal-angular` (AngularJS 1.8.x), which stays in the repo as the
reference implementation and the before/after comparison. Same screens, same copy, same
states, same `data-testid` attributes, and the same frozen API — `docs/api-contract.md` did
not change for this port and neither did `apps/mock-api`.

Scope is the one feature the AngularJS app exposes: the **Provider Directory**
(`GET /api/providers`, `GET /api/providers/{id}`). Appointments, Patient Profile,
Prescriptions and Billing remain API-only.

## What maps to what

| AngularJS (`apps/portal-angular`) | Angular 22 (here) |
| --- | --- |
| `features/providers/services/provider-directory.service.js` (`$http`) | `features/providers/services/provider-directory.service.ts` (`HttpClient`, typed by `models/provider.ts`) |
| `features/providers/pages/provider-directory` (controller + `ng-repeat`) | `features/providers/pages/provider-directory` (signals + `@for`) |
| `features/providers/pages/provider-profile` (controller + `$routeParams`) | `features/providers/pages/provider-profile` (signals + `:id` as a component input) |
| `shared/components/{alert-banner,loading-spinner,empty-state}` | same three, as standalone components with co-located styles |
| `core/http/api-error.interceptor.js` (class-based `$http` interceptor) | `core/http/api-error.interceptor.ts` (`HttpInterceptorFn`) + `core/http/api-error.ts` |
| `core/observability/*` (`$exceptionHandler` decorator) | `core/observability/*` (`ErrorHandler` + `TelemetryService`) |
| `$routeProvider` in `app.module.js` | `app.routes.ts` with `loadComponent` |
| one global `styles.scss` (no encapsulation) | design tokens in `styles.scss`, everything else co-located per component |

The AngularJS `shared/` module also registers `ph-confirm-dialog`, `ph-status-badge`,
`titlecase`, `visitTypeLabel` and `trimmedRequired`, all left over from the removed
Appointments/Billing features with no consumer. They are deliberately **not** ported; the
feature that needs them can bring them back.

File names keep the `.service.ts` / `.page.ts` / `.component.ts` suffixes rather than the 2025
style guide's shorter form, so each file lines up one-to-one with its AngularJS counterpart
while both apps are in the repo.

Two behaviours deliberately differ.

A bio's markup is narrowed before it is rendered (see the invariant below), so a bio carrying an
image renders as text here while the AngularJS app renders the image. Every bio the API seeds
today is text plus that one leftover `<img>` payload, so the visible difference is a broken-image
icon that no longer appears.

`X-Request-Id` falls back to a non-crypto id where
`crypto.randomUUID` is unavailable — it only exists in a secure context, so the AngularJS
interceptor throws and every screen renders the generic error banner when the dev server is
reached over plain http on a LAN address. The id is diagnostic, never authorization, so the
port degrades instead of failing the request.

## Commands

Run these from the repo root wherever possible (`npm run test:angular-v22`, `npm run
lint:angular-v22`, …). Locally, in this directory:

| Command | What it does |
| --- | --- |
| `npm start` | Dev server on `:4201` (the AngularJS app keeps `:4200`), proxying `/api` to `:8000` |
| `npm run build` | Production bundle into `dist/portal-angular-v22/browser` |
| `npm test` | Vitest + jsdom, watching in a TTY |
| `npm run test:ci` | Single Vitest run |
| `npm run lint` | eslint via angular-eslint, over TypeScript **and** templates |
| `npm run typecheck` | `tsc --noEmit` over app and spec sources (templates are type-checked by `npm run build`) |

## Invariant: the bio is sanitized, never trusted

`provider-profile.page.html` renders `bio` with `[innerHTML]`, which runs the value through
Angular's built-in DOM sanitizer. The Angular 17 version of this app called
`DomSanitizer.bypassSecurityTrustHtml` here and shipped a stored-XSS bug; the AngularJS
rewrite fixed it with `ng-bind-html` + `ngSanitize`. **Do not reintroduce any
`bypassSecurityTrust*` call on this field.** `provider-profile.page.spec.ts` renders a bio
carrying an `<img onerror=…>` payload and asserts the handler never reaches the DOM.

Two more gates sit around that sanitizer, because a sanitizer allowlist is not an image-source
policy — Angular's keeps `img`/`picture`/`source` and lets `srcset` through without a URL check,
which is the same gap CVE-2024-8372 and CVE-2024-8373 describe in AngularJS's sanitizer:

- `bio-html.ts`'s `toBioHtml()` reduces a bio to inline formatting (`b`, `strong`, `i`, `em`,
  `u`, `br`, `p`, `span`, `ul`, `ol`, `li`) with no attributes at all, dropping media, scripts
  and embeds outright and unwrapping anything else. It only ever removes markup, and its output
  is still bound through `[innerHTML]`.
- `index.html` sends `img-src 'self' data:` in a CSP, so a media reference that somehow reached
  the DOM still cannot be fetched. Scripts stay on `'self'` with no `unsafe-eval`, which an AOT
  build satisfies and an AngularJS bundle (its `$parse` compiles expressions with `new
  Function`) cannot.
