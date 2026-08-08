import json
import re
from uuid import UUID

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.domain.models import Slot
from app.observability.json_logging import log_path
from app.observability.middleware import (
    REQUEST_ID_HEADER,
    RequestObservabilityMiddleware,
    route_template,
)
from tests.conftest import book

COUNTER = "pulse_http_requests_total"
HISTOGRAM = "pulse_http_request_duration_seconds"
GAUGE = "pulse_appointments"


def counter_value(metrics_text: str, method: str, route: str, status: int) -> float:
    pattern = (
        rf'^{COUNTER}\{{method="{re.escape(method)}",route="{re.escape(route)}",'
        rf'status="{status}"\}} (\S+)$'
    )
    match = re.search(pattern, metrics_text, re.MULTILINE)
    return float(match.group(1)) if match else 0.0


def read_new_log_lines(offset: int) -> list[dict[str, object]]:
    with log_path().open(encoding="utf-8") as handle:
        handle.seek(offset)
        return [json.loads(line) for line in handle if line.strip()]


def log_size() -> int:
    path = log_path()
    return path.stat().st_size if path.exists() else 0


def test_request_id_is_echoed_when_supplied(client: TestClient) -> None:
    response = client.get("/api/appointments", headers={REQUEST_ID_HEADER: "req-abc-123"})

    assert response.status_code == 200
    assert response.headers[REQUEST_ID_HEADER] == "req-abc-123"


def test_request_id_is_generated_when_absent(client: TestClient) -> None:
    response = client.get("/api/appointments")

    assert response.status_code == 200
    generated = response.headers[REQUEST_ID_HEADER]
    assert UUID(generated).version == 4


def test_request_ids_are_unique_per_request(client: TestClient) -> None:
    first = client.get("/api/providers").headers[REQUEST_ID_HEADER]
    second = client.get("/api/providers").headers[REQUEST_ID_HEADER]

    assert first != second


def test_error_responses_also_carry_a_request_id(client: TestClient) -> None:
    response = client.get("/api/appointments/apt_missing")

    assert response.status_code == 404
    assert response.headers[REQUEST_ID_HEADER]


def test_metrics_endpoint_exposes_the_request_metrics(client: TestClient) -> None:
    response = client.get("/metrics")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/plain")
    assert COUNTER in response.text
    assert HISTOGRAM in response.text


def test_metrics_endpoint_is_outside_the_api_prefix(client: TestClient) -> None:
    assert client.get("/api/metrics").status_code == 404


def test_request_counter_increments(client: TestClient) -> None:
    before = counter_value(client.get("/metrics").text, "GET", "/api/providers", 200)

    client.get("/api/providers")

    after = counter_value(client.get("/metrics").text, "GET", "/api/providers", 200)
    assert after == before + 1


def test_counter_labels_use_the_route_template_not_the_id(client: TestClient) -> None:
    client.get("/api/appointments/apt_001")

    metrics_text = client.get("/metrics").text
    assert 'route="/api/appointments/{appointment_id}"' in metrics_text
    assert "apt_001" not in metrics_text


def test_metrics_expose_the_appointment_gauge(client: TestClient) -> None:
    response = client.get("/metrics")

    assert f'{GAUGE}{{status="scheduled"}}' in response.text
    assert f'{GAUGE}{{status="cancelled"}}' in response.text


def test_appointment_gauge_tracks_cancellations(client: TestClient, free_slot: Slot) -> None:
    created = book(client, "prv_001", free_slot.id)

    client.post(f"/api/appointments/{created['id']}/cancel")

    metrics_text = client.get("/metrics").text
    match = re.search(rf'^{GAUGE}{{status="cancelled"}} (\S+)$', metrics_text, re.MULTILINE)
    assert match is not None
    assert float(match.group(1)) >= 1


def test_request_emits_a_parseable_json_log_line(client: TestClient) -> None:
    offset = log_size()

    client.get("/api/appointments?scope=upcoming", headers={REQUEST_ID_HEADER: "req-log-1"})

    entries = read_new_log_lines(offset)
    completed = [entry for entry in entries if entry.get("requestId") == "req-log-1"]
    assert completed, entries
    entry = completed[-1]
    assert set(entry) >= {
        "timestamp",
        "level",
        "logger",
        "message",
        "requestId",
        "method",
        "path",
        "query",
        "route",
        "status",
        "durationMs",
    }
    assert entry["level"] == "INFO"
    assert entry["method"] == "GET"
    assert entry["path"] == "/api/appointments"
    assert entry["query"] == "scope=upcoming"
    assert entry["route"] == "/api/appointments"
    assert entry["status"] == 200
    assert isinstance(entry["durationMs"], float | int)
    assert str(entry["timestamp"]).endswith("Z")


def test_failed_request_is_logged_with_its_error_code(client: TestClient) -> None:
    offset = log_size()

    client.get("/api/appointments/apt_missing", headers={REQUEST_ID_HEADER: "req-log-404"})

    entry = [line for line in read_new_log_lines(offset) if line.get("requestId") == "req-log-404"][
        -1
    ]
    assert entry["status"] == 404


def test_unhandled_exception_is_logged_with_a_stack_trace() -> None:
    """A crash must leave evidence behind without the middleware inventing a response."""
    crashing = FastAPI()
    crashing.add_middleware(RequestObservabilityMiddleware)

    @crashing.get("/boom")
    def boom() -> None:
        raise RuntimeError("kaboom")

    offset = log_size()
    with TestClient(crashing, raise_server_exceptions=False) as crash_client:
        response = crash_client.get("/boom", headers={REQUEST_ID_HEADER: "req-boom"})

    assert response.status_code == 500
    entry = [line for line in read_new_log_lines(offset) if line.get("requestId") == "req-boom"][-1]
    assert entry["level"] == "ERROR"
    assert entry["status"] == 500
    assert entry["route"] == "/boom"
    assert "RuntimeError: kaboom" in str(entry["exception"])
    assert "Traceback" in str(entry["exception"])


def test_api_payload_shape_is_unchanged(client: TestClient) -> None:
    response = client.get("/api/appointments")

    assert response.status_code == 200
    body = response.json()
    assert isinstance(body, list) and body
    assert set(body[0]) == {
        "id",
        "providerId",
        "provider",
        "slotId",
        "startsAt",
        "endsAt",
        "status",
        "visitType",
        "reason",
        "cancellable",
        "createdAt",
        "updatedAt",
    }


def test_error_envelope_is_unchanged(client: TestClient) -> None:
    response = client.get("/api/appointments/apt_missing")

    assert response.status_code == 404
    body = response.json()
    assert set(body) == {"error"}
    assert set(body["error"]) == {"code", "message", "field"}
    assert body["error"]["code"] == "NOT_FOUND"


class _Route:
    """Stands in for a Starlette route, which only needs to expose a path template."""

    def __init__(self, path: str, path_format: str | None = None) -> None:
        self.path = path
        if path_format is not None:
            self.path_format = path_format


def test_route_template_recovers_the_router_prefix() -> None:
    scope = {
        "path": "/api/appointments/apt_001",
        "path_params": {"appointment_id": "apt_001"},
        "route": _Route("/appointments/{appointment_id}", "/appointments/{appointment_id}"),
    }
    assert route_template(scope) == "/api/appointments/{appointment_id}"


def test_route_template_handles_the_path_converter() -> None:
    """Regression: `str.format` raised ValueError on `{full_path:path}`, 500ing every SPA route."""
    scope = {
        "path": "/appointments",
        "path_params": {"full_path": "appointments"},
        "route": _Route("/{full_path:path}", "/{full_path}"),
    }
    assert route_template(scope) == "/{full_path}"


def test_route_template_handles_a_path_converter_without_path_format() -> None:
    scope = {
        "path": "/deep/nested/thing",
        "path_params": {"full_path": "deep/nested/thing"},
        "route": _Route("/{full_path:path}"),
    }
    assert route_template(scope) == "/{full_path}"


def test_route_template_falls_back_when_nothing_matched() -> None:
    assert route_template({"path": "/nope", "path_params": {}, "route": None}) == "unmatched"


def test_catch_all_route_is_served_and_labelled_without_the_converter() -> None:
    """The demo server serves both SPAs from `/{full_path:path}` catch-alls."""
    app = FastAPI()
    app.add_middleware(RequestObservabilityMiddleware)

    @app.get("/spa/{full_path:path}")
    def spa(full_path: str) -> dict[str, str]:
        return {"served": full_path}

    client = TestClient(app)
    response = client.get("/spa/appointments/detail")

    assert response.status_code == 200
    assert response.json() == {"served": "appointments/detail"}
    assert response.headers[REQUEST_ID_HEADER]
