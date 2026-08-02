from fastapi.testclient import TestClient

from app.domain.models import Slot
from tests.conftest import book, error_of

APPOINTMENT_KEYS = {
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


def test_appointment_shape_is_frozen(client: TestClient) -> None:
    appointment = client.get("/api/appointments", params={"scope": "upcoming"}).json()[0]

    assert set(appointment) == APPOINTMENT_KEYS
    assert set(appointment["provider"]) == {"id", "name", "specialty", "locationName"}
    assert appointment["status"] == "scheduled"
    assert appointment["startsAt"].endswith("Z")
    assert appointment["cancellable"] is True


def test_no_scope_returns_everything(client: TestClient) -> None:
    everything = client.get("/api/appointments").json()

    assert len(everything) == 6
    assert {a["status"] for a in everything} == {"scheduled", "completed", "cancelled"}


def test_upcoming_scope_is_scheduled_and_future_ascending(client: TestClient) -> None:
    upcoming = client.get("/api/appointments", params={"scope": "upcoming"}).json()

    assert len(upcoming) == 3
    assert all(a["status"] == "scheduled" for a in upcoming)
    starts = [a["startsAt"] for a in upcoming]
    assert starts == sorted(starts)
    assert {a["providerId"] for a in upcoming} == {"prv_001", "prv_002", "prv_004"}
    assert {a["visitType"] for a in upcoming} == {"in_person", "video", "phone"}


def test_past_scope_is_descending_and_excludes_scheduled_future(client: TestClient) -> None:
    past = client.get("/api/appointments", params={"scope": "past"}).json()

    assert len(past) == 3
    starts = [a["startsAt"] for a in past]
    assert starts == sorted(starts, reverse=True)
    assert {a["status"] for a in past} == {"completed", "cancelled"}
    assert all(a["cancellable"] is False for a in past)


def test_scopes_partition_the_list(client: TestClient) -> None:
    upcoming = client.get("/api/appointments", params={"scope": "upcoming"}).json()
    past = client.get("/api/appointments", params={"scope": "past"}).json()
    everything = client.get("/api/appointments").json()

    assert {a["id"] for a in upcoming} | {a["id"] for a in past} == {a["id"] for a in everything}
    assert not {a["id"] for a in upcoming} & {a["id"] for a in past}


def test_cancelled_future_appointment_moves_to_past(client: TestClient) -> None:
    upcoming_id = client.get("/api/appointments", params={"scope": "upcoming"}).json()[0]["id"]

    client.post(f"/api/appointments/{upcoming_id}/cancel")

    assert upcoming_id not in {
        a["id"] for a in client.get("/api/appointments", params={"scope": "upcoming"}).json()
    }
    assert upcoming_id in {
        a["id"] for a in client.get("/api/appointments", params={"scope": "past"}).json()
    }


def test_status_filter_single_value(client: TestClient) -> None:
    cancelled = client.get("/api/appointments", params={"status": "cancelled"}).json()

    assert len(cancelled) == 1
    assert cancelled[0]["status"] == "cancelled"


def test_status_filter_repeated_values(client: TestClient) -> None:
    response = client.get("/api/appointments?status=completed&status=cancelled")

    statuses = {a["status"] for a in response.json()}
    assert statuses == {"completed", "cancelled"}
    assert len(response.json()) == 3


def test_visit_type_filter_single_and_repeated(client: TestClient) -> None:
    single = client.get("/api/appointments", params={"visitType": "phone"}).json()
    repeated = client.get("/api/appointments?visitType=phone&visitType=video").json()

    assert {a["visitType"] for a in single} == {"phone"}
    assert {a["visitType"] for a in repeated} == {"phone", "video"}
    assert len(repeated) > len(single)


def test_provider_id_filter(client: TestClient) -> None:
    filtered = client.get("/api/appointments", params={"providerId": "prv_002"}).json()

    assert filtered
    assert {a["providerId"] for a in filtered} == {"prv_002"}


def test_filters_combine_with_scope(client: TestClient) -> None:
    filtered = client.get(
        "/api/appointments",
        params={"scope": "upcoming", "visitType": "video", "providerId": "prv_002"},
    ).json()

    assert len(filtered) == 1
    assert filtered[0]["visitType"] == "video"
    assert filtered[0]["providerId"] == "prv_002"


def test_scope_upcoming_with_past_status_is_empty(client: TestClient) -> None:
    assert client.get("/api/appointments?scope=upcoming&status=completed").json() == []


def test_unknown_scope_is_validation_error(client: TestClient) -> None:
    response = client.get("/api/appointments", params={"scope": "tomorrow"})

    assert response.status_code == 422
    detail = error_of(response)
    assert detail["code"] == "VALIDATION_ERROR"
    assert detail["field"] == "scope"


def test_unknown_status_is_validation_error(client: TestClient) -> None:
    response = client.get("/api/appointments", params={"status": "pending"})

    assert response.status_code == 422
    detail = error_of(response)
    assert detail["code"] == "VALIDATION_ERROR"
    assert detail["field"] == "status"


def test_unknown_visit_type_filter_is_validation_error(client: TestClient) -> None:
    response = client.get("/api/appointments", params={"visitType": "telepathy"})

    assert response.status_code == 422
    detail = error_of(response)
    assert detail["code"] == "VALIDATION_ERROR"
    assert detail["field"] == "visitType"


def test_unknown_provider_id_filter_returns_empty(client: TestClient) -> None:
    response = client.get("/api/appointments", params={"providerId": "prv_nope"})

    assert response.status_code == 200
    assert response.json() == []


def test_get_appointment_by_id(client: TestClient, free_slot: Slot) -> None:
    created = book(client, "prv_001", free_slot.id)

    response = client.get(f"/api/appointments/{created['id']}")

    assert response.status_code == 200
    assert response.json() == created


def test_get_missing_appointment_is_not_found(client: TestClient) -> None:
    response = client.get("/api/appointments/apt_missing")

    assert response.status_code == 404
    detail = error_of(response)
    assert detail["code"] == "NOT_FOUND"
    assert detail["field"] == "id"


def test_new_booking_appears_first_in_upcoming(client: TestClient, free_slot: Slot) -> None:
    created = book(client, "prv_001", free_slot.id)

    upcoming = client.get("/api/appointments", params={"scope": "upcoming"}).json()
    assert upcoming[0]["id"] == created["id"]
