from fastapi.testclient import TestClient

PROVIDER_KEYS = {"id", "name", "specialty", "credentials", "locationName", "bio"}


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


def test_get_provider_by_id_returns_that_provider(client: TestClient) -> None:
    response = client.get("/api/providers/prv_003")

    assert response.status_code == 200
    provider = response.json()
    assert provider["id"] == "prv_003"
    assert provider["name"] == "Dr. Priya Raman"
    assert set(provider) == PROVIDER_KEYS


def test_get_unknown_provider_is_not_found(client: TestClient) -> None:
    response = client.get("/api/providers/prv_does_not_exist")

    assert response.status_code == 404
    body = response.json()
    assert body["error"]["code"] == "NOT_FOUND"
    assert body["error"]["field"] == "providerId"


def test_every_provider_has_a_bio(client: TestClient) -> None:
    providers = client.get("/api/providers").json()

    for provider in providers:
        assert isinstance(provider["bio"], str)
        assert provider["bio"]
