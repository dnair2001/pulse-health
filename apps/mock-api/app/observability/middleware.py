"""Correlation ids, one structured log line per request, and metric recording."""

import logging
import re
import time
import uuid
from collections.abc import Awaitable, Callable, Mapping

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from starlette.types import Scope

from app.observability.context import bind_request_id, current_trace_id, reset_request_id
from app.observability.metrics import observe_request

REQUEST_ID_HEADER = "X-Request-Id"

# Used instead of the raw path for unroutable requests so that 404s on random
# URLs cannot blow up Prometheus label cardinality.
UNMATCHED_ROUTE = "unmatched"

logger = logging.getLogger("app.request")

# Matches one Starlette path placeholder, with or without a converter suffix:
# `{appointment_id}` and `{full_path:path}` both yield the name in group 1.
_PLACEHOLDER = re.compile(r"\{([^{}:]+)(?::[^{}]*)?\}")


def _strip_converters(template: str) -> str:
    """`/react/{full_path:path}` -> `/react/{full_path}`."""
    return _PLACEHOLDER.sub(lambda m: "{" + m.group(1) + "}", template)


def _fill(template: str, params: Mapping[str, object]) -> str:
    """Substitute concrete param values into a template.

    `str.format` cannot be used here: it reads the `:path` in `{full_path:path}`
    as a format spec and raises ValueError, which took down every SPA route and
    every 404 that fell through to a catch-all.
    """
    return _PLACEHOLDER.sub(lambda m: str(params.get(m.group(1), "")), template)


def route_template(scope: Scope) -> str:
    """The matched route's path template, e.g. `/api/appointments/{appointment_id}`."""
    path = str(scope.get("path") or "/")
    params: Mapping[str, object] = scope.get("path_params") or {}
    route = scope.get("route")
    # `path_format` is FastAPI's converter-free form; `path` is the fallback for
    # plain Starlette routes that do not expose it.
    raw = getattr(route, "path_format", None) or getattr(route, "path", None)
    if not isinstance(raw, str):
        # Either nothing matched (404/405) or a plain Starlette route such as
        # /openapi.json, which FastAPI does not record in the scope.
        return path if scope.get("endpoint") is not None and not params else UNMATCHED_ROUTE
    template = _strip_converters(raw)
    # The template is relative to the router it was included on, so the mount
    # prefix has to be recovered from the concrete request path.
    tail = _fill(template, params)
    prefix = path[: len(path) - len(tail)] if tail and path.endswith(tail) else ""
    return prefix + template


class RequestObservabilityMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        request_id = request.headers.get(REQUEST_ID_HEADER) or str(uuid.uuid4())
        token = bind_request_id(request_id)
        request.state.request_id = request_id
        started = time.perf_counter()
        try:
            try:
                response = await call_next(request)
            except Exception:
                duration_ms = (time.perf_counter() - started) * 1000
                fields = _fields(request, 500, duration_ms)
                logger.exception("request failed", extra=fields)
                observe_request(request.method, str(fields["route"]), 500, duration_ms / 1000)
                # Re-raised so the client still receives the app's own error
                # response rather than one invented here.
                raise
            duration_ms = (time.perf_counter() - started) * 1000
            response.headers[REQUEST_ID_HEADER] = request_id
            fields = _fields(request, response.status_code, duration_ms)
            logger.info("request completed", extra=fields)
            observe_request(
                request.method, str(fields["route"]), response.status_code, duration_ms / 1000
            )
            return response
        finally:
            reset_request_id(token)


def _fields(request: Request, status: int, duration_ms: float) -> dict[str, object]:
    fields: dict[str, object] = {
        "method": request.method,
        "path": request.url.path,
        "query": request.url.query,
        "route": route_template(request.scope),
        "status": status,
        "durationMs": round(duration_ms, 3),
    }
    trace_id = current_trace_id()
    if trace_id is not None:
        fields["traceId"] = trace_id
    return fields
