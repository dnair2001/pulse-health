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

from pathlib import Path

from fastapi.responses import FileResponse

from app.main import app

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
        return FileResponse(candidate)
    return FileResponse(root / "index.html")


# Registered before the catch-all below, so /react wins over the Angular fallback.
@app.get("/react", include_in_schema=False)
@app.get("/react/{full_path:path}", include_in_schema=False)
def react_spa(full_path: str = "") -> FileResponse:
    return _serve(REACT_DIST, full_path)


@app.get("/{full_path:path}", include_in_schema=False)
def angular_spa(full_path: str) -> FileResponse:
    return _serve(ANGULAR_DIST, full_path)
