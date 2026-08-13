## What changed

<!-- One or two sentences. What behaviour is different after this PR? -->

## Why

<!-- Link an issue if there is one. -->

## Checklist

Definition of done (see [AGENTS.md](../AGENTS.md)):

- [ ] `npm run lint` passes
- [ ] `npm run typecheck` and `npm run format:check` pass
- [ ] `npm test` passes (170 pytest + 12 Karma = 182)
- [ ] `npm run build` passes
- [ ] `npm run check:duplication` and `npm run check:doc-freshness` pass

Invariants:

- [ ] **The API contract is frozen.** No field renamed, no status code changed, no response
      wrapped. `docs/api-contract.md` still describes the API exactly (camelCase keys, UTC
      ISO-8601 with `Z`, bare JSON arrays from collection endpoints, one error envelope).
- [ ] **Business rules stayed server-side** in `apps/mock-api/app/domain/rules.py`. No
      client-side-only guard was added.
- [ ] `apps/portal-angular` was not modernized (NgModules, class-based interceptor, `ph-`
      selector prefix all intact).

## Verification

<!--
For changes to user-visible strings or date rendering, tests are not sufficient. Run
`npm run demo` and check the rendered text of the affected page yourself, or run
`npm run test:e2e`. Paste what you did and what you saw.
-->
