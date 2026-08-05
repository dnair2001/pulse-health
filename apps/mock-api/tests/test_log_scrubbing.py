"""JsonFormatter must not let arbitrary `extra=` values reach disk or stdout.

The formatter promotes every LogRecord attribute that isn't a standard
`logging` attribute into the emitted JSON object. Historically that meant any
future `extra={"reason": appointment.reason}` call would persist real
user-entered free text (see `app/domain/models.py`) verbatim to
`data/logs/api.log`. These tests assert the allowlist/scrub behaviour that
closes that gap, on both sinks the formatter actually feeds.
"""

import io
import json
import logging

from app.observability.json_logging import JsonFormatter, log_path

FREE_TEXT = "some free-text health detail"


def read_new_log_lines(offset: int) -> list[dict[str, object]]:
    with log_path().open(encoding="utf-8") as handle:
        handle.seek(offset)
        return [json.loads(line) for line in handle if line.strip()]


def log_size() -> int:
    path = log_path()
    return path.stat().st_size if path.exists() else 0


def make_stream_logger(name: str) -> tuple[logging.Logger, io.StringIO]:
    """A logger with its own StreamHandler + JsonFormatter, isolated from root.

    Mirrors what `configure_logging()` wires onto `sys.stdout`, but with a
    `StringIO` we can actually read back in a test.
    """
    stream = io.StringIO()
    handler = logging.StreamHandler(stream)
    handler.setFormatter(JsonFormatter())
    logger = logging.getLogger(name)
    logger.setLevel(logging.INFO)
    logger.propagate = False
    logger.handlers = [handler]
    return logger, stream


def read_stream_lines(stream: io.StringIO) -> list[dict[str, object]]:
    return [json.loads(line) for line in stream.getvalue().splitlines() if line.strip()]


def test_unsafe_extra_field_is_scrubbed_on_the_stream_sink() -> None:
    logger, stream = make_stream_logger("tests.scrub.stream.unsafe")

    logger.info("appointment cancelled", extra={"reason": FREE_TEXT})

    entries = read_stream_lines(stream)
    assert entries
    entry = entries[-1]
    assert FREE_TEXT not in stream.getvalue()
    assert entry["reason"] == "<scrubbed:reason>"


def test_allowlisted_fields_pass_through_unchanged_on_the_stream_sink() -> None:
    logger, stream = make_stream_logger("tests.scrub.stream.safe")
    fields = {
        "method": "GET",
        "path": "/api/appointments",
        "query": "scope=upcoming",
        "route": "/api/appointments",
        "status": 200,
        "durationMs": 12.5,
        "traceId": "trace-abc",
        "requestId": "req-abc-123",
    }

    logger.info("request completed", extra=fields)

    entry = read_stream_lines(stream)[-1]
    for key, value in fields.items():
        assert entry[key] == value


def test_mixed_extra_fields_only_scrub_the_unsafe_ones() -> None:
    logger, stream = make_stream_logger("tests.scrub.stream.mixed")

    logger.info(
        "request completed",
        extra={
            "method": "POST",
            "path": "/api/appointments",
            "status": 201,
            "durationMs": 5.0,
            "requestId": "req-mix-1",
            "reason": FREE_TEXT,
            "notes": "also free text",
        },
    )

    entry = read_stream_lines(stream)[-1]
    assert entry["method"] == "POST"
    assert entry["path"] == "/api/appointments"
    assert entry["status"] == 201
    assert entry["durationMs"] == 5.0
    assert entry["requestId"] == "req-mix-1"
    assert entry["reason"] == "<scrubbed:reason>"
    assert entry["notes"] == "<scrubbed:notes>"
    assert FREE_TEXT not in stream.getvalue()
    assert "also free text" not in stream.getvalue()


def test_unsafe_extra_field_is_scrubbed_on_the_file_sink() -> None:
    """The real root-logger handlers, wired by `configure_logging()` at app
    import time, feed `data/logs/api.log`. This proves scrubbing applies
    there too, not just to a hand-built handler."""
    offset = log_size()
    logger = logging.getLogger("tests.scrub.file")

    logger.info("appointment cancelled", extra={"reason": FREE_TEXT, "requestId": "req-file-1"})

    entries = read_new_log_lines(offset)
    matches = [entry for entry in entries if entry.get("requestId") == "req-file-1"]
    assert matches
    entry = matches[-1]
    assert entry["reason"] == "<scrubbed:reason>"
    with log_path().open(encoding="utf-8") as handle:
        handle.seek(offset)
        raw = handle.read()
    assert FREE_TEXT not in raw


def test_structurally_weird_extra_values_do_not_crash_the_formatter() -> None:
    logger, stream = make_stream_logger("tests.scrub.stream.weird")

    logger.info(
        "weird payload",
        extra={
            "nested": {"a": {"b": [1, 2, {"c": FREE_TEXT}]}},
            "huge": "x" * 50_000,
            "requestId": "req-weird-1",
        },
    )

    entry = read_stream_lines(stream)[-1]
    assert entry["nested"] == "<scrubbed:nested>"
    assert entry["huge"] == "<scrubbed:huge>"
    assert entry["requestId"] == "req-weird-1"
    assert FREE_TEXT not in stream.getvalue()
