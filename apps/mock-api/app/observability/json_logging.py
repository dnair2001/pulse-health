"""One JSON object per line, to stdout and to a file agents can read afterwards."""

import json
import logging
import logging.handlers
import sys
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from app.config import settings
from app.observability.context import current_request_id, current_trace_id

_MAX_BYTES = 5 * 1024 * 1024
_BACKUP_COUNT = 3

# Attributes every LogRecord carries. Anything else on the record arrived via
# `extra=` and belongs in the emitted JSON object.
_STANDARD_ATTRS = frozenset(
    {
        "args",
        "asctime",
        "created",
        "exc_info",
        "exc_text",
        "filename",
        "funcName",
        "levelname",
        "levelno",
        "lineno",
        "message",
        "module",
        "msecs",
        "msg",
        "name",
        "pathname",
        "process",
        "processName",
        "relativeCreated",
        "stack_info",
        "taskName",
        "thread",
        "threadName",
    }
)

_OWNED_HANDLER_FLAG = "_pulse_observability"

# uvicorn installs its own handlers on these; clearing them routes its output
# through the JSON formatter instead of duplicating it in a second format.
_ADOPTED_LOGGERS = ("uvicorn", "uvicorn.error", "uvicorn.access", "fastapi")


class JsonFormatter(logging.Formatter):
    """Serialise a record as a single-line JSON object."""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "timestamp": _isoformat(record.created),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        for key, value in record.__dict__.items():
            if key not in _STANDARD_ATTRS and not key.startswith("_"):
                payload[key] = value
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        if record.stack_info:
            payload["stack"] = self.formatStack(record.stack_info)
        return json.dumps(payload, default=str)


class RequestContextFilter(logging.Filter):
    """Attach the current request and trace ids to every record."""

    def filter(self, record: logging.LogRecord) -> bool:
        request_id = current_request_id()
        if request_id is not None and not hasattr(record, "requestId"):
            record.requestId = request_id
        trace_id = current_trace_id()
        if trace_id is not None and not hasattr(record, "traceId"):
            record.traceId = trace_id
        return True


def log_path() -> Path:
    return Path(settings.log_path)


def _isoformat(created: float) -> str:
    return (
        datetime.fromtimestamp(created, UTC)
        .isoformat(timespec="milliseconds")
        .replace("+00:00", "Z")
    )


def configure_logging() -> Path:
    """Install JSON handlers on the root logger. Safe to call more than once."""
    path = log_path()
    path.parent.mkdir(parents=True, exist_ok=True)

    formatter = JsonFormatter()
    context_filter = RequestContextFilter()
    handlers: list[logging.Handler] = [
        logging.StreamHandler(sys.stdout),
        logging.handlers.RotatingFileHandler(
            path, maxBytes=_MAX_BYTES, backupCount=_BACKUP_COUNT, encoding="utf-8"
        ),
    ]
    for handler in handlers:
        handler.setFormatter(formatter)
        handler.addFilter(context_filter)
        setattr(handler, _OWNED_HANDLER_FLAG, True)

    root = logging.getLogger()
    for existing in list(root.handlers):
        if getattr(existing, _OWNED_HANDLER_FLAG, False):
            root.removeHandler(existing)
            existing.close()
    for handler in handlers:
        root.addHandler(handler)
    root.setLevel(settings.log_level.upper())

    for name in _ADOPTED_LOGGERS:
        adopted = logging.getLogger(name)
        adopted.handlers = []
        adopted.propagate = True

    return path
