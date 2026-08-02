from fastapi.testclient import TestClient

PROVIDER_KEYS = {"id", "name", "specialty", "credentials", "locationName"}


def test_providers_returns_bare_array_of_four(client: TestClient) -> None:
    response = client.get("/api/providers")

    assert response.status_code == 200
    providers = response.json()
    assert isinstance(providers, list)
    assert len(providers) == 4
    assert [p["id"] for p in providers] == ["prv_001", "prv_002", "prv_003", "prv_004"]


def test_provider_shape_is_camel_case(client: TestClient) -> None:
    provider = client.get("/api/providers").json()[0]

    assert set(provider) == PROVIDER_KEYS
    assert provider["name"] == "Dr. Alice Nguyen"
    assert provider["specialty"] == "Primary Care"
    assert provider["locationName"] == "Pulse Health Downtown"


def test_specialties_are_distinct(client: TestClient) -> None:
    providers = client.get("/api/providers").json()

    assert len({p["specialty"] for p in providers}) == 4
