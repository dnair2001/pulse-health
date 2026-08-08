import json
from pathlib import Path

from fastapi.testclient import TestClient

from app.domain.models import AppointmentStatus, Slot, StoreData
from app.seed import build_seed
from app.store import Store
from tests.conftest import book


def test_store_writes_a_seed_file_on_first_use(store: Store) -> None:
    assert store.path.exists()
    payload = json.loads(store.path.read_text(encoding="utf-8"))
    assert set(payload) == {"providers", "patients", "visitTypes", "slots", "appointments"}
    assert payload["providers"][0]["locationName"] == "Pulse Health Downtown"


def test_booking_survives_a_store_rebuild_from_disk(
    client: TestClient, free_slot: Slot, store: Store
) -> None:
    created = book(client, "prv_001", free_slot.id)

    reloaded = Store(store.path)

    record = next(r for r in reloaded.read().appointments if r.id == created["id"])
    assert record.reason == created["reason"]
    assert record.status is AppointmentStatus.SCHEDULED
    slot = next(s for s in reloaded.read().slots if s.id == free_slot.id)
    assert slot.is_booked is True


def test_cancellation_survives_a_store_rebuild_from_disk(
    client: TestClient, free_slot: Slot, store: Store
) -> None:
    created = book(client, "prv_001", free_slot.id)
    client.post(f"/api/appointments/{created['id']}/cancel")

    reloaded = Store(store.path)

    record = next(r for r in reloaded.read().appointments if r.id == created["id"])
    assert record.status is AppointmentStatus.CANCELLED
    slot = next(s for s in reloaded.read().slots if s.id == free_slot.id)
    assert slot.is_booked is False


def test_reschedule_survives_a_store_rebuild_from_disk(
    client: TestClient, free_slot: Slot, other_free_slot: Slot, store: Store
) -> None:
    created = book(client, "prv_001", free_slot.id)
    client.patch(f"/api/appointments/{created['id']}", json={"slotId": other_free_slot.id})

    slots = {slot.id: slot for slot in Store(store.path).read().slots}

    assert slots[free_slot.id].is_booked is False
    assert slots[other_free_slot.id].is_booked is True


def test_read_returns_a_copy_that_cannot_corrupt_the_store(store: Store) -> None:
    snapshot = store.read()
    snapshot.appointments.clear()

    assert len(store.read().appointments) == 6


def test_failed_transaction_is_not_persisted(store: Store) -> None:
    class Boom(RuntimeError):
        pass

    try:
        with store.transaction() as working:
            working.appointments.clear()
            raise Boom
    except Boom:
        pass

    assert len(store.read().appointments) == 6
    assert len(Store(store.path).read().appointments) == 6


def test_corrupt_store_file_is_reseeded(tmp_path: Path) -> None:
    path = tmp_path / "broken.json"
    path.write_text("{ this is not the store }", encoding="utf-8")

    rebuilt = Store(path)

    assert len(rebuilt.read().providers) == 4
    assert json.loads(path.read_text(encoding="utf-8"))["visitTypes"]


def test_dev_reset_rebuilds_the_store(client: TestClient, free_slot: Slot, store: Store) -> None:
    created = book(client, "prv_001", free_slot.id)

    response = client.post("/api/dev/reset")

    assert response.status_code == 200
    assert response.json() == {"status": "reset"}
    assert client.get(f"/api/appointments/{created['id']}").status_code == 404
    assert len(store.read().appointments) == 6
    reloaded = Store(store.path).read()
    assert next(s for s in reloaded.slots if s.id == free_slot.id).is_booked is False


def test_seed_is_internally_consistent() -> None:
    seeded: StoreData = build_seed()

    slot_ids = {slot.id for slot in seeded.slots}
    provider_ids = {provider.id for provider in seeded.providers}
    booked_ids = {slot.id for slot in seeded.slots if slot.is_booked}

    for record in seeded.appointments:
        assert record.slot_id in slot_ids
        assert record.provider_id in provider_ids
        assert (record.slot_id in booked_ids) is (record.status is not AppointmentStatus.CANCELLED)

    assert len(slot_ids) == len(seeded.slots)
