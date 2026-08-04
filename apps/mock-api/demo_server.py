"""Serves both compiled frontends and the API on a single port.

    /              the Angular bundle
    /react/...     the React bundle
    /api/...       the mock API

Run it with `npm run demo` from the repo root, which builds both bundles first.

This exists for viewing the apps over a forwarded port from another machine. The dev servers
each hold a live-reload websocket open for the lifetime of the page, which some tunnels handle
badly: the first load succeeds and every request after it hangs. Compiled bundles over plain
HTTP keep every connection short-lived, and one port means one tunnel.
"""

import re
from pathlib import Path

from fastapi.responses import FileResponse, HTMLResponse
from starlette.middleware.gzip import GZipMiddleware

from app.main import app

# Everything here crosses a forwarded port, where bytes cost far more than CPU. Uncompressed a
# cold React load is ~380 kB and GET /api/slots alone is ~70 kB of very repetitive JSON.
app.add_middleware(GZipMiddleware, minimum_size=500)

# Vite and the Angular CLI both content-hash their output, so those URLs can never go stale.
HASHED_ASSET = re.compile(r"-[A-Za-z0-9_]{8,}\.(js|css)$")

IMMUTABLE = "public, max-age=31536000, immutable"
# index.html names the hashed bundles, so it has to be revalidated or a rebuild is invisible.
REVALIDATE = "no-cache"

REPO_ROOT = Path(__file__).resolve().parents[2]
ANGULAR_DIST = REPO_ROOT / "apps/portal-angular/dist/portal-angular/browser"
REACT_DIST = REPO_ROOT / "apps/portal-react/dist-demo"

for dist in (ANGULAR_DIST, REACT_DIST):
    if not (dist / "index.html").is_file():
        raise RuntimeError(
            f"{dist} has no index.html. Run `npm run demo:build` from the repo root."
        )


def _serve(root: Path, relative: str) -> FileResponse:
    """Static file if it exists, otherwise the SPA entry point so deep links work."""
    candidate = (root / relative).resolve()
    if relative and candidate.is_file() and candidate.is_relative_to(root):
        cache = IMMUTABLE if HASHED_ASSET.search(candidate.name) else REVALIDATE
        return FileResponse(candidate, headers={"cache-control": cache})
    return FileResponse(root / "index.html", headers={"cache-control": REVALIDATE})


LANDING = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Pulse Health demo</title>
<style>
  :root { color-scheme: light }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center;
         font: 16px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
         background: #f6f8fa; color: #0f172a }
  main { width: min(46rem, calc(100% - 3rem)) }
  h1 { font-size: 1.5rem; margin: 0 0 .25rem }
  p.lede { margin: 0 0 2rem; color: #52616f }
  .apps { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr)) }
  a.app { display: block; padding: 1.25rem 1.5rem; border: 1px solid #d7dee6;
          border-radius: .625rem; background: #fff; text-decoration: none; color: inherit }
  a.app:hover { border-color: #0f766e; box-shadow: 0 1px 4px rgb(15 118 110 / .15) }
  a.app strong { display: block; font-size: 1.0625rem; margin-bottom: .25rem }
  a.app span { color: #52616f; font-size: .875rem }
  footer { margin-top: 2rem; color: #52616f; font-size: .8125rem }
  code { background: #eef2f6; padding: .1rem .3rem; border-radius: .25rem }
</style>
</head>
<body>
<main>
  <h1>Pulse Health</h1>
  <p class="lede">The same Appointment Scheduling feature, two frontends, one API.</p>
  <div class="apps">
    <a class="app" href="/appointments">
      <strong>Angular 17</strong>
      <span>The legacy baseline. NgModules, RxJS, Karma.</span>
    </a>
    <a class="app" href="/react/appointments">
      <strong>React 19</strong>
      <span>The migrated port. Vite, TanStack Query, Vitest.</span>
    </a>
  </div>
  <footer>
    Both read and write the same store, so a booking in one shows up in the other on refresh.
    Reseed with <code>npm run reset:data</code>.
  </footer>
</main>
</body>
</html>
"""


@app.get("/demo", include_in_schema=False)
def landing() -> HTMLResponse:
    """One page to open, linking to both frontends, so neither app needs a link to the other."""
    return HTMLResponse(LANDING, headers={"cache-control": REVALIDATE})


# Registered before the catch-all below, so /react wins over the Angular fallback.
@app.get("/react", include_in_schema=False)
@app.get("/react/{full_path:path}", include_in_schema=False)
def react_spa(full_path: str = "") -> FileResponse:
    return _serve(REACT_DIST, full_path)


@app.get("/{full_path:path}", include_in_schema=False)
def angular_spa(full_path: str) -> FileResponse:
    return _serve(ANGULAR_DIST, full_path)
