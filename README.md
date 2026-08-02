# webapp

Angular frontend and FastAPI backend in one repository. Working title, rename when you pick a name.

## Stack

| Layer | Choice |
| --- | --- |
| Frontend | Angular 22 (standalone, zoneless, vitest) |
| Styling | Tailwind CSS 4 via `@tailwindcss/postcss` |
| Backend | FastAPI 0.141 on uvicorn, Python 3.12 |
| Config | `pydantic-settings`, `APP_` env prefix |

## Layout

```
frontend/            Angular workspace
  src/app/core/      API client
  src/app/pages/     Routed pages (home, about)
  proxy.conf.json    Dev-server proxy: /api -> localhost:8000
backend/
  app/main.py        App factory, CORS, router wiring
  app/api/health.py  GET /api/health
  app/config.py      Settings
  tests/             pytest suite
```

## Setup

```bash
make install
```

Requires Node 22+ and Python 3.12+.

## Run

Two terminals:

```bash
make backend    # http://localhost:8000  (docs at /docs)
make frontend   # http://localhost:4200
```

The Angular dev server proxies `/api` to the backend, so the browser sees one
origin and CORS does not apply in development.

## Test

```bash
make test           # both suites
make test-backend   # pytest
make test-frontend  # vitest via ng test
make build          # production frontend build
```

## Adding an endpoint

1. Create a router in `backend/app/api/`, include it in `create_app()`.
2. Add a method plus response interface to `frontend/src/app/core/api.ts`.
3. Consume it from a page under `frontend/src/app/pages/`.
