# Security Policy

## What this project is

Pulse Health is a **demo**. It exists to show a legacy Angular app being modernized to React
while behaviour stays identical. The backend (`apps/mock-api`) is a mock: it has no
authentication, no authorization, no database, and no real patient data. State lives in a
gitignored JSON file (`apps/mock-api/data/store.json`) seeded with obviously fictional
appointments, and there is a `POST /api/dev/reset` endpoint that wipes and reseeds it.

Do not deploy this as-is and do not put real personal or health information into it.

## Supported versions

Only the `main` branch. There are no releases and no backports.

## Reporting a vulnerability

Please **do not** open a public issue for a security problem.

Use GitHub's private reporting: **Security → Advisories → Report a vulnerability** on this
repository. If private reporting is unavailable to you, contact the maintainer
([@dnair2001](https://github.com/dnair2001)) directly through GitHub.

Include what you can: affected file or endpoint, steps to reproduce, and impact.

This is a personal demo project, not a product with an on-call rotation. Expect an
acknowledgement within about a week, and a fix on a best-effort basis. There is no bug bounty.

## In scope

- Vulnerabilities in the repository's own code or CI configuration — for example a workflow that
  leaks `GITHUB_TOKEN`, a dependency with a known exploitable CVE, or a committed secret.
- XSS or injection in either frontend.

## Out of scope

The following are known, intentional properties of a mock backend and are not vulnerabilities
here:

- The API is unauthenticated and every endpoint is world-readable and world-writable.
- `POST /api/dev/reset` destroys all state without a credential.
- CORS and the dev-server proxy are permissive so the frontends can talk to `localhost:8000`.
- No rate limiting, no CSRF tokens, no audit log.
