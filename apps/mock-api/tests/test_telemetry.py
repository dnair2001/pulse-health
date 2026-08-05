"""POST /api/telemetry: the one place a frontend's own logging/error events land."""

import json
import re

from fastapi.testclient import TestClient

from app.observability.json_logging import log_path
from app.observability.middleware import REQUEST_ID_HEADER
from tests.conftest import error_of

COUNTER = "pulse_frontend_events_total"


def read_new_log_lines(offset: int) -> list[dict[str, object]]:
    with log_path().open(encoding="utf-8") as handle:
        handle.seek(offset)
        return [json.loads(line) for line in handle if line.strip()]


def log_size() -> int:
    path = log_path()
    return path.stat().st_size if path.exists() else 0


def test_valid_event_returns_no_content(client: TestClient) -> None:
    response = client.post(
        "/api/telemetry",
        json={"source": "react", "level": "info", "message": "app mounted"},
    )

    assert response.status_code == 204
    assert response.content == b""


def test_event_is_folded_into_the_json_log(client: TestClient) -> None:
    offset = log_size()

    client.post(
        "/api/telemetry",
        json={
            "source": "angular",
            "level": "error",
            "message": "failed to load slots",
            "route": "/appointments/schedule",
            "requestId": "client-req-999",
            "errorCode": "NETWORK_ERROR",
        },
    )

    entries = read_new_log_lines(offset)
    matches = [entry for entry in entries if entry.get("clientRequestId") == "client-req-999"]
    assert matches, entries
    entry = matches[-1]
    assert entry["level"] == "ERROR"
    assert entry["message"] == "failed to load slots"
    assert entry["source"] == "angular"
    assert entry["route"] == "/appointments/schedule"
    assert entry["errorCode"] == "NETWORK_ERROR"


def test_level_maps_to_the_matching_log_severity(client: TestClient) -> None:
    offset = log_size()

    client.post(
        "/api/telemetry",
        json={"source": "react", "level": "warn", "message": "slow response", "errorCode": "X"},
    )

    entry = [line for line in read_new_log_lines(offset) if line.get("errorCode") == "X"][-1]
    assert entry["level"] == "WARNING"


def test_a_reported_client_request_id_does_not_shadow_this_calls_own_request_id(
    client: TestClient,
) -> None:
    """`requestId` in the JSON body must land as `clientRequestId`, not overwrite the
    RequestContextFilter's `requestId` for *this* /api/telemetry call itself."""
    offset = log_size()

    client.post(
        "/api/telemetry",
        json={"source": "react", "level": "error", "message": "boom", "requestId": "old-call-id"},
        headers={REQUEST_ID_HEADER: "this-call-id"},
    )

    entry = [
        line for line in read_new_log_lines(offset) if line.get("clientRequestId") == "old-call-id"
    ][-1]
    assert entry["requestId"] == "this-call-id"


def test_optional_fields_are_omitted_from_the_log_when_not_supplied(client: TestClient) -> None:
    offset = log_size()

    client.post(
        "/api/telemetry",
        json={"source": "react", "level": "info", "message": "unique marker for this test"},
    )

    entry = [
        line
        for line in read_new_log_lines(offset)
        if line.get("message") == "unique marker for this test"
    ][-1]
    assert "route" not in entry
    assert "clientRequestId" not in entry
    assert "errorCode" not in entry


def test_invalid_source_is_rejected(client: TestClient) -> None:
    response = client.post(
        "/api/telemetry",
        json={"source": "vue", "level": "info", "message": "nope"},
    )

    assert response.status_code == 422
    assert error_of(response)["field"] == "source"


def test_invalid_level_is_rejected(client: TestClient) -> None:
    response = client.post(
        "/api/telemetry",
        json={"source": "react", "level": "debug", "message": "nope"},
    )

    assert response.status_code == 422
    assert error_of(response)["field"] == "level"


def test_empty_message_is_rejected(client: TestClient) -> None:
    response = client.post(
        "/api/telemetry",
        json={"source": "react", "level": "info", "message": ""},
    )

    assert response.status_code == 422


def test_overlong_message_is_rejected(client: TestClient) -> None:
    response = client.post(
        "/api/telemetry",
        json={"source": "react", "level": "info", "message": "x" * 501},
    )

    assert response.status_code == 422


def test_a_free_text_context_field_is_not_accepted(client: TestClient) -> None:
    """Regression guard for the reason FrontendEvent has no `context: dict` field at
    all: an open-ended object here would let arbitrary data bypass the log scrubber's
    field-name allowlist. Pydantic ignores unknown fields by default, so this asserts
    the call still succeeds *and* that nothing named "context" reaches the log."""
    offset = log_size()

    response = client.post(
        "/api/telemetry",
        json={
            "source": "react",
            "level": "info",
            "message": "context field probe",
            "context": {"reason": "some free-text health detail"},
        },
    )

    assert response.status_code == 204
    entry = [
        line for line in read_new_log_lines(offset) if line.get("message") == "context field probe"
    ][-1]
    assert "context" not in entry
    assert "reason" not in entry


def test_metrics_endpoint_exposes_the_frontend_event_counter(client: TestClient) -> None:
    before_text = client.get("/metrics").text

    def count(text: str) -> float:
        match = re.search(
            rf'^{COUNTER}\{{level="info",source="react"\}} (\S+)$', text, re.MULTILINE
        )
        return float(match.group(1)) if match else 0.0

    before = count(before_text)

    client.post(
        "/api/telemetry",
        json={"source": "react", "level": "info", "message": "metric probe"},
    )

    after = count(client.get("/metrics").text)
    assert after == before + 1


def test_telemetry_endpoint_does_not_appear_in_the_openapi_success_schema_as_domain_data(
    client: TestClient,
) -> None:
    """Sanity check that this stays a 204, not accidentally a 200 with a body, since
    the frozen contract tests elsewhere assert exact response shapes per endpoint."""
    response = client.post(
        "/api/telemetry",
        json={"source": "angular", "level": "info", "message": "schema probe"},
    )
    assert response.status_code == 204
    assert response.text == ""
