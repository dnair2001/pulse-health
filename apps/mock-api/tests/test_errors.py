import pytest
from fastapi.testclient import TestClient

from app.domain.models import Slot
from tests.conftest import error_of

ERROR_CODES = {
    "VALIDATION_ERROR",
    "SLOT_IN_PAST",
    "SLOT_ALREADY_BOOKED",
    "APPOINTMENT_NOT_CANCELLABLE",
    "APPOINTMENT_NOT_RESCHEDULABLE",
    "NOT_FOUND",
}


def test_malformed_body_returns_the_frozen_envelope(client: TestClient) -> None:
    response = client.post(
        "/api/appointments",
        content=b"{not json at all",
        headers={"Content-Type": "application/json"},
    )

    assert response.status_code == 422
    body = response.json()
    assert list(body) == ["error"]
    assert list(body["error"]) == ["code", "message", "field"]
    assert body["error"]["code"] == "VALIDATION_ERROR"
    assert isinstance(body["error"]["message"], str)


def test_empty_body_returns_the_envelope(client: TestClient) -> None:
    response = client.post("/api/appointments", json={})

    assert response.status_code == 422
    detail = error_of(response)
    assert detail["code"] == "VALIDATION_ERROR"
    assert detail["field"] == "providerId"


def test_wrong_body_type_returns_the_envelope(client: TestClient) -> None:
    response = client.post("/api/appointments", json=["not", "an", "object"])

    assert response.status_code == 422
    assert error_of(response)["code"] == "VALIDATION_ERROR"


def test_wrong_field_type_returns_the_envelope(client: TestClient, free_slot: Slot) -> None:
    response = client.post(
        "/api/appointments",
        json={
            "providerId": "prv_001",
            "slotId": free_slot.id,
            "visitType": "video",
            "reason": 42,
        },
    )

    assert response.status_code == 422
    detail = error_of(response)
    assert detail["code"] == "VALIDATION_ERROR"
    assert detail["field"] == "reason"


def test_unknown_route_returns_the_envelope(client: TestClient) -> None:
    response = client.get("/api/nope")

    assert response.status_code == 404
    detail = error_of(response)
    assert detail["code"] == "NOT_FOUND"
    assert detail["field"] is None


def test_wrong_method_returns_the_envelope(client: TestClient) -> None:
    response = client.delete("/api/appointments/apt_001")

    assert response.status_code == 405
    assert error_of(response)["code"] in ERROR_CODES


@pytest.mark.parametrize(
    ("method", "path", "payload"),
    [
        ("get", "/api/appointments/apt_missing", None),
        ("post", "/api/appointments/apt_missing/cancel", None),
        ("patch", "/api/appointments/apt_missing", {"slotId": "slt_nope"}),
        ("post", "/api/appointments", {"providerId": "prv_001"}),
        ("get", "/api/appointments?scope=bogus", None),
    ],
)
def test_every_error_path_uses_one_envelope(
    client: TestClient, method: str, path: str, payload: dict[str, str] | None
) -> None:
    response = client.request(method.upper(), path, json=payload)

    assert response.status_code >= 400
    detail = error_of(response)
    assert detail["code"] in ERROR_CODES
    assert detail["field"] is None or isinstance(detail["field"], str)


def test_error_messages_are_ui_safe(client: TestClient) -> None:
    response = client.post("/api/appointments", json={"providerId": "prv_001"})

    message = error_of(response)["message"]
    assert "Traceback" not in message
    assert message.endswith(".")
