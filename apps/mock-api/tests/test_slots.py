from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient

from app.domain.models import Slot, StoreData
from app.domain.rules import now_utc
from tests.conftest import book, error_of, free_slots

ISO_Z = "%Y-%m-%dT%H:%M:%SZ"


def parse(value: str) -> datetime:
    return datetime.strptime(value, ISO_Z).replace(tzinfo=UTC)


def test_slot_shape_and_camel_case(client: TestClient) -> None:
    slot = client.get("/api/slots").json()[0]

    assert set(slot) == {"id", "providerId", "startsAt", "endsAt", "isBooked"}
    assert slot["id"].startswith("slt_")
    assert slot["startsAt"].endswith("Z")
    assert slot["isBooked"] is False


def test_slots_are_sorted_ascending_by_starts_at(client: TestClient) -> None:
    starts = [slot["startsAt"] for slot in client.get("/api/slots").json()]

    assert starts == sorted(starts)


def test_slots_are_thirty_minutes_long(client: TestClient) -> None:
    for slot in client.get("/api/slots").json():
        assert parse(slot["endsAt"]) - parse(slot["startsAt"]) == timedelta(minutes=30)


def test_past_slots_are_never_returned(client: TestClient, data: StoreData) -> None:
    assert any(slot.starts_at < now_utc() for slot in data.slots), "seed needs past slots"

    returned = client.get("/api/slots").json()
    assert returned
    assert all(parse(slot["startsAt"]) > now_utc() for slot in returned)


def test_past_slots_hidden_even_with_include_booked(client: TestClient) -> None:
    returned = client.get("/api/slots", params={"includeBooked": "true"}).json()

    assert all(parse(slot["startsAt"]) > now_utc() for slot in returned)


def test_provider_id_filter(client: TestClient) -> None:
    returned = client.get("/api/slots", params={"providerId": "prv_002"}).json()

    assert returned
    assert {slot["providerId"] for slot in returned} == {"prv_002"}


def test_unknown_provider_id_filter_returns_empty_list(client: TestClient) -> None:
    response = client.get("/api/slots", params={"providerId": "prv_nope"})

    assert response.status_code == 200
    assert response.json() == []


def test_include_booked_defaults_to_false(
    client: TestClient, free_slot: Slot, other_free_slot: Slot
) -> None:
    book(client, "prv_001", free_slot.id)

    default_ids = {slot["id"] for slot in client.get("/api/slots").json()}
    assert free_slot.id not in default_ids
    assert other_free_slot.id in default_ids


def test_include_booked_true_reveals_booked_slots(client: TestClient, free_slot: Slot) -> None:
    book(client, "prv_001", free_slot.id)

    returned = client.get("/api/slots", params={"includeBooked": "true"}).json()
    booked = next(slot for slot in returned if slot["id"] == free_slot.id)
    assert booked["isBooked"] is True


def test_from_and_to_bounds_are_inclusive(client: TestClient, data: StoreData) -> None:
    slots = free_slots(data, "prv_003")
    lower, upper = slots[2], slots[5]

    returned = client.get(
        "/api/slots",
        params={
            "providerId": "prv_003",
            "from": lower.starts_at.strftime(ISO_Z),
            "to": upper.starts_at.strftime(ISO_Z),
        },
    ).json()

    ids = [slot["id"] for slot in returned]
    assert ids == [slot.id for slot in slots[2:6]]


def test_from_bound_accepts_naive_datetime(client: TestClient, data: StoreData) -> None:
    third = free_slots(data, "prv_001")[3]

    response = client.get(
        "/api/slots",
        params={"providerId": "prv_001", "from": third.starts_at.strftime("%Y-%m-%dT%H:%M:%S")},
    )

    assert response.status_code == 200
    assert response.json()[0]["id"] == third.id


def test_to_bound_in_the_past_returns_empty(client: TestClient) -> None:
    yesterday = (now_utc() - timedelta(days=1)).strftime(ISO_Z)

    assert client.get("/api/slots", params={"to": yesterday}).json() == []


def test_slots_skip_weekends(client: TestClient) -> None:
    for slot in client.get("/api/slots").json():
        assert parse(slot["startsAt"]).weekday() < 5


def test_business_hours_bounds(client: TestClient) -> None:
    times = {slot["startsAt"][11:16] for slot in client.get("/api/slots").json()}

    assert min(times) == "09:00"
    assert max(times) == "16:30"


def test_unparseable_from_bound_returns_validation_envelope(client: TestClient) -> None:
    response = client.get("/api/slots", params={"from": "not-a-date"})

    assert response.status_code == 422
    detail = error_of(response)
    assert detail["code"] == "VALIDATION_ERROR"
    assert detail["field"] == "from"
