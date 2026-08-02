from fastapi.testclient import TestClient


def test_visit_types_ids_are_frozen(client: TestClient) -> None:
    response = client.get("/api/visit-types")

    assert response.status_code == 200
    visit_types = response.json()
    assert [v["id"] for v in visit_types] == ["in_person", "video", "phone"]


def test_visit_type_shape(client: TestClient) -> None:
    first = client.get("/api/visit-types").json()[0]

    assert set(first) == {"id", "label", "durationMinutes"}
    assert first == {"id": "in_person", "label": "In person", "durationMinutes": 30}


def test_durations_are_positive_ints(client: TestClient) -> None:
    for visit_type in client.get("/api/visit-types").json():
        assert isinstance(visit_type["durationMinutes"], int)
        assert visit_type["durationMinutes"] > 0
