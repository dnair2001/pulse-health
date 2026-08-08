from fastapi.testclient import TestClient

from tests.conftest import error_of

PROFILE_KEYS = {
    "id",
    "name",
    "dateOfBirth",
    "ssnLast4",
    "email",
    "phone",
    "addressLine",
    "city",
    "state",
    "postalCode",
    "emergencyContactName",
    "emergencyContactPhone",
}

VALID_UPDATE = {
    "email": "jordan.updated@example.com",
    "phone": "555-201-4477",
    "addressLine": "17 Cedar Court",
    "city": "Rivertown",
    "state": "WA",
    "postalCode": "98033",
    "emergencyContactName": "Sam Reyes",
    "emergencyContactPhone": "555-201-9981",
}


def test_get_my_profile_shape(client: TestClient) -> None:
    response = client.get("/api/patients/me")

    assert response.status_code == 200
    profile = response.json()
    assert set(profile) == PROFILE_KEYS
    assert profile["id"] == "pat_001"
    assert profile["name"] == "Jordan Reyes"


def test_get_my_profile_only_exposes_the_last_four_of_the_ssn(client: TestClient) -> None:
    profile = client.get("/api/patients/me").json()

    assert profile["ssnLast4"] == "6789"
    assert "ssn" not in profile


def test_update_my_profile_persists_editable_fields(client: TestClient) -> None:
    response = client.patch("/api/patients/me", json=VALID_UPDATE)

    assert response.status_code == 200
    updated = response.json()
    assert updated["email"] == VALID_UPDATE["email"]
    assert updated["addressLine"] == VALID_UPDATE["addressLine"]

    refetched = client.get("/api/patients/me").json()
    assert refetched["email"] == VALID_UPDATE["email"]


def test_update_my_profile_does_not_allow_changing_identity_fields(client: TestClient) -> None:
    before = client.get("/api/patients/me").json()

    client.patch("/api/patients/me", json=VALID_UPDATE)

    after = client.get("/api/patients/me").json()
    assert after["name"] == before["name"]
    assert after["dateOfBirth"] == before["dateOfBirth"]
    assert after["ssnLast4"] == before["ssnLast4"]


def test_update_my_profile_rejects_an_invalid_email(client: TestClient) -> None:
    response = client.patch("/api/patients/me", json={**VALID_UPDATE, "email": "not-an-email"})

    assert response.status_code == 422
    detail = error_of(response)
    assert detail["field"] == "email"


def test_update_my_profile_rejects_an_invalid_phone(client: TestClient) -> None:
    response = client.patch("/api/patients/me", json={**VALID_UPDATE, "phone": "abc"})

    assert response.status_code == 422
    assert error_of(response)["field"] == "phone"


def test_update_my_profile_rejects_a_blank_required_field(client: TestClient) -> None:
    response = client.patch("/api/patients/me", json={**VALID_UPDATE, "city": "   "})

    assert response.status_code == 422
    assert error_of(response)["field"] == "city"


def test_verify_identity_succeeds_with_the_matching_ssn_and_date_of_birth(
    client: TestClient,
) -> None:
    response = client.get(
        "/api/patients/verify", params={"ssn": "231-45-6789", "dob": "1985-06-12"}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["verified"] is True
    assert body["insuranceMemberId"] == "PHX-88213045"


def test_verify_identity_fails_with_the_wrong_ssn(client: TestClient) -> None:
    response = client.get(
        "/api/patients/verify", params={"ssn": "000-00-0000", "dob": "1985-06-12"}
    )

    assert response.status_code == 401
    assert error_of(response)["code"] == "IDENTITY_NOT_VERIFIED"


def test_verify_identity_requires_both_query_parameters(client: TestClient) -> None:
    response = client.get("/api/patients/verify", params={"ssn": "231-45-6789"})

    assert response.status_code == 422
