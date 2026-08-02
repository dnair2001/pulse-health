import httpx
from fastapi.testclient import TestClient

from app.domain.models import Slot, StoreData
from app.store import Store
from tests.conftest import book, error_of, free_slots


def create(client: TestClient, **overrides: str) -> httpx.Response:
    payload: dict[str, str] = {
        "providerId": "prv_001",
        "slotId": "",
        "visitType": "in_person",
        "reason": "Annual physical",
    }
    payload.update(overrides)
    return client.post("/api/appointments", json=payload)


def test_booking_returns_201_and_full_appointment(client: TestClient, free_slot: Slot) -> None:
    response = client.post(
        "/api/appointments",
        json={
            "providerId": "prv_001",
            "slotId": free_slot.id,
            "visitType": "video",
            "reason": "  Knee pain  ",
        },
    )

    assert response.status_code == 201
    created = response.json()
    assert created["id"].startswith("apt_")
    assert created["slotId"] == free_slot.id
    assert created["providerId"] == "prv_001"
    assert created["provider"]["name"] == "Dr. Alice Nguyen"
    assert created["status"] == "scheduled"
    assert created["visitType"] == "video"
    assert created["reason"] == "Knee pain"
    assert created["cancellable"] is True
    assert created["startsAt"] == free_slot.starts_at.strftime("%Y-%m-%dT%H:%M:%SZ")
    assert created["endsAt"] == free_slot.ends_at.strftime("%Y-%m-%dT%H:%M:%SZ")
    assert created["createdAt"] == created["updatedAt"]


def test_booking_marks_the_slot_booked(client: TestClient, free_slot: Slot, store: Store) -> None:
    book(client, "prv_001", free_slot.id)

    stored = next(slot for slot in store.read().slots if slot.id == free_slot.id)
    assert stored.is_booked is True


def test_rule_1_slot_in_the_past_is_rejected(client: TestClient, past_slot: Slot) -> None:
    response = create(client, providerId=past_slot.provider_id, slotId=past_slot.id)

    assert response.status_code == 422
    detail = error_of(response)
    assert detail["code"] == "SLOT_IN_PAST"
    assert detail["field"] == "slotId"


def test_rule_2_slot_cannot_be_double_booked(client: TestClient, free_slot: Slot) -> None:
    book(client, "prv_001", free_slot.id)

    response = create(client, slotId=free_slot.id)

    assert response.status_code == 409
    detail = error_of(response)
    assert detail["code"] == "SLOT_ALREADY_BOOKED"
    assert detail["field"] == "slotId"


def test_rule_2_also_guards_seeded_bookings(client: TestClient, data: StoreData) -> None:
    booked = next(slot for slot in data.slots if slot.is_booked and slot.provider_id == "prv_001")

    response = create(client, providerId="prv_001", slotId=booked.id)

    detail = error_of(response)
    assert detail["code"] in {"SLOT_ALREADY_BOOKED", "SLOT_IN_PAST"}


def test_rule_3_reason_is_required(client: TestClient, free_slot: Slot) -> None:
    response = client.post(
        "/api/appointments",
        json={"providerId": "prv_001", "slotId": free_slot.id, "visitType": "in_person"},
    )

    assert response.status_code == 422
    detail = error_of(response)
    assert detail["code"] == "VALIDATION_ERROR"
    assert detail["field"] == "reason"


def test_rule_3_blank_reason_is_rejected(client: TestClient, free_slot: Slot) -> None:
    response = create(client, slotId=free_slot.id, reason="   ")

    assert response.status_code == 422
    detail = error_of(response)
    assert detail["code"] == "VALIDATION_ERROR"
    assert detail["field"] == "reason"


def test_rule_3_short_reason_is_rejected(client: TestClient, free_slot: Slot) -> None:
    response = create(client, slotId=free_slot.id, reason=" ab ")

    assert response.status_code == 422
    detail = error_of(response)
    assert detail["code"] == "VALIDATION_ERROR"
    assert detail["field"] == "reason"


def test_rule_3_reason_at_max_length_is_accepted(client: TestClient, free_slot: Slot) -> None:
    response = create(client, slotId=free_slot.id, reason="x" * 500)

    assert response.status_code == 201


def test_rule_3_too_long_reason_is_rejected(client: TestClient, free_slot: Slot) -> None:
    response = create(client, slotId=free_slot.id, reason="x" * 501)

    assert response.status_code == 422
    detail = error_of(response)
    assert detail["code"] == "VALIDATION_ERROR"
    assert detail["field"] == "reason"


def test_bad_visit_type_is_validation_error(client: TestClient, free_slot: Slot) -> None:
    response = create(client, slotId=free_slot.id, visitType="carrier_pigeon")

    assert response.status_code == 422
    detail = error_of(response)
    assert detail["code"] == "VALIDATION_ERROR"
    assert detail["field"] == "visitType"


def test_rule_7_slot_must_belong_to_provider(client: TestClient, data: StoreData) -> None:
    other = free_slots(data, "prv_002")[0]

    response = create(client, providerId="prv_001", slotId=other.id)

    assert response.status_code == 422
    detail = error_of(response)
    assert detail["code"] == "VALIDATION_ERROR"
    assert detail["field"] == "slotId"


def test_missing_provider_is_not_found(client: TestClient, free_slot: Slot) -> None:
    response = create(client, providerId="prv_nope", slotId=free_slot.id)

    assert response.status_code == 404
    detail = error_of(response)
    assert detail["code"] == "NOT_FOUND"
    assert detail["field"] == "providerId"


def test_missing_slot_is_not_found(client: TestClient) -> None:
    response = create(client, slotId="slt_does_not_exist")

    assert response.status_code == 404
    detail = error_of(response)
    assert detail["code"] == "NOT_FOUND"
    assert detail["field"] == "slotId"


def test_failed_booking_leaves_the_slot_free(
    client: TestClient, free_slot: Slot, store: Store
) -> None:
    create(client, slotId=free_slot.id, reason="no")

    stored = next(slot for slot in store.read().slots if slot.id == free_slot.id)
    assert stored.is_booked is False
    assert len(store.read().appointments) == 6


def test_ids_increment_across_bookings(client: TestClient, data: StoreData) -> None:
    slots = free_slots(data, "prv_003")

    first = book(client, "prv_003", slots[0].id)
    second = book(client, "prv_003", slots[1].id)

    assert first["id"] == "apt_007"
    assert second["id"] == "apt_008"
