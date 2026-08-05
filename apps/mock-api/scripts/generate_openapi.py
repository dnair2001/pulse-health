"""Regenerate openapi.json from the live FastAPI schema.

Run this after any change to endpoints, request/response models, or status codes, then commit
the diff. CI runs the same command and fails the build if the committed file and the live
schema disagree, so this can't go stale silently.
"""

import json
from pathlib import Path

from app.main import app

OUTPUT = Path(__file__).resolve().parent.parent / "openapi.json"


def main() -> None:
    spec = app.openapi()
    OUTPUT.write_text(json.dumps(spec, indent=2, sort_keys=True) + "\n")
    print(f"Wrote {OUTPUT}")


if __name__ == "__main__":
    main()
