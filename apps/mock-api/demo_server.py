"""Serves the compiled Angular bundle and the API on a single port.

    /              the Angular bundle
    /api/...       the mock API

Run it with `npm run demo` from the repo root, which builds the bundle first.

This exists for viewing the app over a forwarded port from another machine. The dev server
holds a live-reload websocket open for the lifetime of the page, which some tunnels handle
badly: the first load succeeds and every request after it hangs. A compiled bundle over plain
HTTP keeps every connection short-lived, and one port means one tunnel.
"""

import re
from pathlib import Path

from fastapi.responses import FileResponse
from starlette.middleware.gzip import GZipMiddleware

from app.main import app

# Everything here crosses a forwarded port, where bytes cost far more than CPU, and
# GET /api/slots alone is ~70 kB of very repetitive JSON.
app.add_middleware(GZipMiddleware, minimum_size=500)

# The Angular CLI content-hashes its output, so those URLs can never go stale.
HASHED_ASSET = re.compile(r"-[A-Za-z0-9_]{8,}\.(js|css)$")

IMMUTABLE = "public, max-age=31536000, immutable"
# index.html names the hashed bundles, so it has to be revalidated or a rebuild is invisible.
REVALIDATE = "no-cache"

REPO_ROOT = Path(__file__).resolve().parents[2]
ANGULAR_DIST = REPO_ROOT / "apps/portal-angular/dist/portal-angular/browser"

if not (ANGULAR_DIST / "index.html").is_file():
    raise RuntimeError(
        f"{ANGULAR_DIST} has no index.html. Run `npm run demo:build` from the repo root."
    )


def _serve(root: Path, relative: str) -> FileResponse:
    """Static file if it exists, otherwise the SPA entry point so deep links work."""
    candidate = (root / relative).resolve()
    if relative and candidate.is_file() and candidate.is_relative_to(root):
        cache = IMMUTABLE if HASHED_ASSET.search(candidate.name) else REVALIDATE
        return FileResponse(candidate, headers={"cache-control": cache})
    return FileResponse(root / "index.html", headers={"cache-control": REVALIDATE})


@app.get("/{full_path:path}", include_in_schema=False)
def angular_spa(full_path: str) -> FileResponse:
    return _serve(ANGULAR_DIST, full_path)
