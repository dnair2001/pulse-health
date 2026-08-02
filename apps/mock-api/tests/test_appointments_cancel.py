from fastapi.testclient import TestClient

from app.domain.models import AppointmentStatus, Slot, StoreData
from app.store import Store
from tests.conftest import book, error_of


def seeded_id(data: StoreData, status: AppointmentStatus) -> str:
    return next(record.id for record in data.appointments if record.status is status)


def test_rule_5_cancel_sets_status_and_frees_the_slot(
    client: TestClient, free_slot: Slot, store: Store
) -> None:
    created = book(client, "prv_001", free_slot.id)

    response = client.post(f"/api/appointments/{created['id']}/cancel")

    assert response.status_code == 200
    cancelled = response.json()
    assert cancelled["status"] == "cancelled"
    assert cancelled["cancellable"] is False
    assert cancelled["slotId"] == free_slot.id
    assert cancelled["updatedAt"] >= created["updatedAt"]

    stored = next(slot for slot in store.read().slots if slot.id == free_slot.id)
    assert stored.is_booked is False
    assert free_slot.id in {slot["id"] for slot in client.get("/api/slots").json()}


def test_cancelled_slot_can_be_booked_again(client: TestClient, free_slot: Slot) -> None:
    created = book(client, "prv_001", free_slot.id)
    client.post(f"/api/appointments/{created['id']}/cancel")

    rebooked = book(client, "prv_001", free_slot.id)

    assert rebooked["id"] != created["id"]
    assert rebooked["status"] == "scheduled"


def test_rule_4_completed_appointment_cannot_be_cancelled(
    client: TestClient, data: StoreData
) -> None:
    completed_id = seeded_id(data, AppointmentStatus.COMPLETED)

    response = client.post(f"/api/appointments/{completed_id}/cancel")

    assert response.status_code == 409
    detail = error_of(response)
    assert detail["code"] == "APPOINTMENT_NOT_CANCELLABLE"
    assert detail["field"] is None


def test_rule_4_cancelled_appointment_cannot_be_cancelled_again(
    client: TestClient, data: StoreData
) -> None:
    cancelled_id = seeded_id(data, AppointmentStatus.CANCELLED)

    response = client.post(f"/api/appointments/{cancelled_id}/cancel")

    assert response.status_code == 409
    assert error_of(response)["code"] == "APPOINTMENT_NOT_CANCELLABLE"


def test_double_cancel_of_own_booking_is_conflict(client: TestClient, free_slot: Slot) -> None:
    created = book(client, "prv_001", free_slot.id)
    client.post(f"/api/appointments/{created['id']}/cancel")

    response = client.post(f"/api/appointments/{created['id']}/cancel")

    assert response.status_code == 409
    assert error_of(response)["code"] == "APPOINTMENT_NOT_CANCELLABLE"


def test_cancel_missing_appointment_is_not_found(client: TestClient) -> None:
    response = client.post("/api/appointments/apt_nope/cancel")

    assert response.status_code == 404
    detail = error_of(response)
    assert detail["code"] == "NOT_FOUND"
    assert detail["field"] == "id"


def test_cancellable_is_false_for_past_scheduled_appointment(
    client: TestClient, data: StoreData, store: Store
) -> None:
    past = next(
        record for record in data.appointments if record.status is AppointmentStatus.COMPLETED
    )
    with store.transaction() as working:
        for index, record in enumerate(working.appointments):
            if record.id == past.id:
                working.appointments[index] = record.model_copy(
                    update={"status": AppointmentStatus.SCHEDULED}
                )

    appointment = client.get(f"/api/appointments/{past.id}").json()

    assert appointment["status"] == "scheduled"
    assert appointment["cancellable"] is False
    assert past.id in {a["id"] for a in client.get("/api/appointments?scope=past").json()}
