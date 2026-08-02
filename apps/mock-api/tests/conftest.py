from collections.abc import Iterator
from pathlib import Path
from typing import Any

import httpx
import pytest
from fastapi.testclient import TestClient

from app import store as store_module
from app.domain.models import Slot, StoreData
from app.domain.rules import now_utc
from app.main import app
from app.store import Store


@pytest.fixture(autouse=True)
def store(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[Store]:
    """Freshly seeded, tmp-backed store so no test can touch data/store.json."""
    instance = Store(tmp_path / "store.json")
    monkeypatch.setattr(store_module, "_store", instance)
    yield instance
    monkeypatch.setattr(store_module, "_store", None)


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def data(store: Store) -> StoreData:
    return store.read()


def free_slots(data: StoreData, provider_id: str) -> list[Slot]:
    now = now_utc()
    return sorted(
        (
            slot
            for slot in data.slots
            if slot.provider_id == provider_id and not slot.is_booked and slot.starts_at > now
        ),
        key=lambda slot: slot.starts_at,
    )


@pytest.fixture
def free_slot(data: StoreData) -> Slot:
    return free_slots(data, "prv_001")[0]


@pytest.fixture
def other_free_slot(data: StoreData) -> Slot:
    return free_slots(data, "prv_001")[1]


@pytest.fixture
def past_slot(data: StoreData) -> Slot:
    now = now_utc()
    return next(slot for slot in data.slots if slot.starts_at < now and not slot.is_booked)


def book(client: TestClient, provider_id: str, slot_id: str, **overrides: str) -> dict[str, Any]:
    payload: dict[str, str] = {
        "providerId": provider_id,
        "slotId": slot_id,
        "visitType": "in_person",
        "reason": "Knee pain follow-up",
    }
    payload.update(overrides)
    response = client.post("/api/appointments", json=payload)
    assert response.status_code == 201, response.text
    created: dict[str, Any] = response.json()
    return created


def error_of(response: httpx.Response) -> dict[str, Any]:
    """Assert the frozen envelope shape and hand back the error detail."""
    body: dict[str, Any] = response.json()
    assert set(body) == {"error"}
    detail: dict[str, Any] = body["error"]
    assert set(detail) == {"code", "message", "field"}
    assert isinstance(detail["message"], str) and detail["message"]
    return detail
