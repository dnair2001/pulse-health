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

from fastapi.responses import FileResponse
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


# Registered before the catch-all below, so /react wins over the Angular fallback.
@app.get("/react", include_in_schema=False)
@app.get("/react/{full_path:path}", include_in_schema=False)
def react_spa(full_path: str = "") -> FileResponse:
    return _serve(REACT_DIST, full_path)


@app.get("/{full_path:path}", include_in_schema=False)
def angular_spa(full_path: str) -> FileResponse:
    return _serve(ANGULAR_DIST, full_path)
