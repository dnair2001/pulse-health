from fastapi.testclient import TestClient

from app.domain.models import AppointmentStatus, Slot, StoreData
from app.domain.rules import now_utc
from app.store import Store
from tests.conftest import book, error_of, free_slots

ISO_Z = "%Y-%m-%dT%H:%M:%SZ"


def test_rule_6_reschedule_swaps_slot_booking(
    client: TestClient, free_slot: Slot, other_free_slot: Slot, store: Store
) -> None:
    created = book(client, "prv_001", free_slot.id)

    response = client.patch(
        f"/api/appointments/{created['id']}", json={"slotId": other_free_slot.id}
    )

    assert response.status_code == 200
    updated = response.json()
    assert updated["id"] == created["id"]
    assert updated["slotId"] == other_free_slot.id
    assert updated["startsAt"] == other_free_slot.starts_at.strftime(ISO_Z)
    assert updated["endsAt"] == other_free_slot.ends_at.strftime(ISO_Z)
    assert updated["status"] == "scheduled"
    assert updated["reason"] == created["reason"]
    assert updated["createdAt"] == created["createdAt"]

    slots = {slot.id: slot for slot in store.read().slots}
    assert slots[free_slot.id].is_booked is False
    assert slots[other_free_slot.id].is_booked is True


def test_reschedule_target_must_be_free(
    client: TestClient, free_slot: Slot, other_free_slot: Slot
) -> None:
    first = book(client, "prv_001", free_slot.id)
    book(client, "prv_001", other_free_slot.id)

    response = client.patch(f"/api/appointments/{first['id']}", json={"slotId": other_free_slot.id})

    assert response.status_code == 409
    detail = error_of(response)
    assert detail["code"] == "SLOT_ALREADY_BOOKED"
    assert detail["field"] == "slotId"


def test_reschedule_onto_own_slot_reports_already_booked(
    client: TestClient, free_slot: Slot
) -> None:
    created = book(client, "prv_001", free_slot.id)

    response = client.patch(f"/api/appointments/{created['id']}", json={"slotId": free_slot.id})

    assert response.status_code == 409
    assert error_of(response)["code"] == "SLOT_ALREADY_BOOKED"


def test_reschedule_into_the_past_is_rejected(
    client: TestClient, free_slot: Slot, data: StoreData
) -> None:
    created = book(client, "prv_001", free_slot.id)
    now = now_utc()
    past = next(
        slot
        for slot in data.slots
        if slot.provider_id == "prv_001" and slot.starts_at < now and not slot.is_booked
    )

    response = client.patch(f"/api/appointments/{created['id']}", json={"slotId": past.id})

    assert response.status_code == 422
    detail = error_of(response)
    assert detail["code"] == "SLOT_IN_PAST"
    assert detail["field"] == "slotId"


def test_reschedule_to_another_providers_slot_is_rejected(
    client: TestClient, free_slot: Slot, data: StoreData
) -> None:
    created = book(client, "prv_001", free_slot.id)
    foreign = free_slots(data, "prv_002")[0]

    response = client.patch(f"/api/appointments/{created['id']}", json={"slotId": foreign.id})

    assert response.status_code == 422
    detail = error_of(response)
    assert detail["code"] == "VALIDATION_ERROR"
    assert detail["field"] == "slotId"


def test_reschedule_to_unknown_slot_is_not_found(client: TestClient, free_slot: Slot) -> None:
    created = book(client, "prv_001", free_slot.id)

    response = client.patch(f"/api/appointments/{created['id']}", json={"slotId": "slt_nope"})

    assert response.status_code == 404
    detail = error_of(response)
    assert detail["code"] == "NOT_FOUND"
    assert detail["field"] == "slotId"


def test_rule_6_completed_appointment_cannot_be_rescheduled(
    client: TestClient, data: StoreData
) -> None:
    completed_id = next(
        record.id for record in data.appointments if record.status is AppointmentStatus.COMPLETED
    )
    target = free_slots(data, "prv_001")[0]

    response = client.patch(f"/api/appointments/{completed_id}", json={"slotId": target.id})

    assert response.status_code == 409
    detail = error_of(response)
    assert detail["code"] == "APPOINTMENT_NOT_RESCHEDULABLE"
    assert detail["field"] is None


def test_rule_6_cancelled_appointment_cannot_be_rescheduled(
    client: TestClient, free_slot: Slot, other_free_slot: Slot
) -> None:
    created = book(client, "prv_001", free_slot.id)
    client.post(f"/api/appointments/{created['id']}/cancel")

    response = client.patch(
        f"/api/appointments/{created['id']}", json={"slotId": other_free_slot.id}
    )

    assert response.status_code == 409
    assert error_of(response)["code"] == "APPOINTMENT_NOT_RESCHEDULABLE"


def test_reschedule_missing_appointment_is_not_found(client: TestClient, free_slot: Slot) -> None:
    response = client.patch("/api/appointments/apt_nope", json={"slotId": free_slot.id})

    assert response.status_code == 404
    assert error_of(response)["code"] == "NOT_FOUND"


def test_failed_reschedule_leaves_both_slots_untouched(
    client: TestClient, free_slot: Slot, data: StoreData, store: Store
) -> None:
    created = book(client, "prv_001", free_slot.id)
    foreign = free_slots(data, "prv_002")[0]

    client.patch(f"/api/appointments/{created['id']}", json={"slotId": foreign.id})

    slots = {slot.id: slot for slot in store.read().slots}
    assert slots[free_slot.id].is_booked is True
    assert slots[foreign.id].is_booked is False
    assert client.get(f"/api/appointments/{created['id']}").json()["slotId"] == free_slot.id
