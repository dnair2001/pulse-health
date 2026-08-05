## What changed

<!-- One or two sentences. What behaviour is different after this PR? -->

## Why

<!-- Link an issue if there is one. -->

## Checklist

Definition of done (see [AGENTS.md](../AGENTS.md)):

- [ ] `npm run lint` passes
- [ ] `npm run typecheck` and `npm run format:check` pass
- [ ] `npm test` passes (121 pytest + 45 Karma + 71 Vitest = 237)
- [ ] `npm run build` passes
- [ ] `TZ=America/New_York npm run test:react` passes — non-UTC runs have caught real
      date-formatting bugs that `TZ=UTC` hid

Invariants:

- [ ] **The API contract is frozen.** No field renamed, no status code changed, no response
      wrapped. `docs/api-contract.md` still describes the API exactly (camelCase keys, UTC
      ISO-8601 with `Z`, bare JSON arrays from collection endpoints, one error envelope).
- [ ] **Business rules stayed server-side** in `apps/mock-api/app/domain/rules.py`. No
      client-side-only guard was added.
- [ ] **Both frontends render byte-identical user-visible text** — same labels, date formats,
      empty states, and punctuation (including the en dash in time ranges). Any string changed
      in one app is changed in the other *in this PR*.
- [ ] Angular is still the reference implementation; where the two disagreed, React was fixed.
- [ ] `apps/portal-angular` was not modernized (NgModules, class-based interceptor, `ph-`
      selector prefix all intact).
- [ ] If `apps/portal-angular/src/styles.scss` or `app.component.scss` changed, the change was
      **copied** into `apps/portal-react/src/styles/global.scss` rather than re-typed.

## Verification

<!--
For changes to user-visible strings or date rendering, tests are not sufficient. Run
`npm run demo` and diff the rendered text of /appointments against /react/appointments.
Paste what you did and what you saw.
-->
