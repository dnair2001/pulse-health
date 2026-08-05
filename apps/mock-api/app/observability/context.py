"""Per-request identifiers shared between middleware, handlers and log records."""

from contextvars import ContextVar, Token

from opentelemetry import trace

_INVALID_TRACE_ID = 0

_request_id: ContextVar[str | None] = ContextVar("pulse_request_id", default=None)


def bind_request_id(request_id: str) -> Token[str | None]:
    return _request_id.set(request_id)


def reset_request_id(token: Token[str | None]) -> None:
    _request_id.reset(token)


def current_request_id() -> str | None:
    """The `X-Request-Id` of the request being served, if any."""
    return _request_id.get()


def current_trace_id() -> str | None:
    """The active OpenTelemetry trace id as lowercase hex, or None when untraced."""
    span_context = trace.get_current_span().get_span_context()
    if span_context.trace_id == _INVALID_TRACE_ID:
        return None
    return format(span_context.trace_id, "032x")
