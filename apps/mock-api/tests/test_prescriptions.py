from fastapi.testclient import TestClient

from tests.conftest import error_of

PRESCRIPTION_KEYS = {
    "id",
    "providerId",
    "provider",
    "medicationName",
    "dosage",
    "frequency",
    "instructions",
    "status",
    "refillsRemaining",
    "lastFilledAt",
    "createdAt",
    "updatedAt",
}


def test_list_prescriptions_returns_five_seeded_records(client: TestClient) -> None:
    response = client.get("/api/prescriptions")

    assert response.status_code == 200
    prescriptions = response.json()
    assert len(prescriptions) == 5
    assert set(prescriptions[0]) == PRESCRIPTION_KEYS


def test_prescription_embeds_a_provider_summary(client: TestClient) -> None:
    prescriptions = client.get("/api/prescriptions").json()
    lisinopril = next(p for p in prescriptions if p["medicationName"] == "Lisinopril")

    assert lisinopril["provider"]["id"] == "prv_001"
    assert "credentials" not in lisinopril["provider"]


def test_filtering_by_status(client: TestClient) -> None:
    active = client.get("/api/prescriptions", params={"status": "active"}).json()
    completed = client.get("/api/prescriptions", params={"status": "completed"}).json()

    assert len(active) == 4
    assert len(completed) == 1
    assert completed[0]["medicationName"] == "Amoxicillin"


def test_filtering_by_an_invalid_status_is_a_validation_error(client: TestClient) -> None:
    response = client.get("/api/prescriptions", params={"status": "not-a-status"})

    assert response.status_code == 422
    assert error_of(response)["field"] == "status"


def test_get_prescription_by_id(client: TestClient) -> None:
    response = client.get("/api/prescriptions/rx_001")

    assert response.status_code == 200
    assert response.json()["medicationName"] == "Lisinopril"


def test_get_unknown_prescription_is_not_found(client: TestClient) -> None:
    response = client.get("/api/prescriptions/rx_does_not_exist")

    assert response.status_code == 404
    assert error_of(response)["field"] == "id"


def test_refill_request_decrements_refills_remaining(client: TestClient) -> None:
    before = client.get("/api/prescriptions/rx_001").json()

    response = client.post("/api/prescriptions/rx_001/refill-request")

    assert response.status_code == 200
    after = response.json()
    assert after["refillsRemaining"] == before["refillsRemaining"] - 1


def test_refill_request_with_no_refills_remaining_is_rejected(client: TestClient) -> None:
    # rx_002 (Metformin) is seeded with 0 refills remaining.
    response = client.post("/api/prescriptions/rx_002/refill-request")

    assert response.status_code == 409
    assert error_of(response)["code"] == "NO_REFILLS_REMAINING"


def test_refill_request_on_a_completed_prescription_is_rejected(client: TestClient) -> None:
    # rx_004 (Amoxicillin) is seeded as completed.
    response = client.post("/api/prescriptions/rx_004/refill-request")

    assert response.status_code == 409
    assert error_of(response)["code"] == "PRESCRIPTION_NOT_REFILLABLE"


def test_refill_request_on_an_unknown_prescription_is_not_found(client: TestClient) -> None:
    response = client.post("/api/prescriptions/rx_does_not_exist/refill-request")

    assert response.status_code == 404
