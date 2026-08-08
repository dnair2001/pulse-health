from fastapi.testclient import TestClient

from tests.conftest import error_of

INVOICE_KEYS = {
    "id",
    "providerId",
    "provider",
    "serviceDescription",
    "billedAmountCents",
    "insurancePaidCents",
    "patientResponsibilityCents",
    "amountPaidCents",
    "balanceCents",
    "status",
    "overdue",
    "dueDate",
    "issuedAt",
    "updatedAt",
}


def test_list_invoices_returns_five_seeded_records(client: TestClient) -> None:
    response = client.get("/api/billing/invoices")

    assert response.status_code == 200
    invoices = response.json()
    assert len(invoices) == 5
    assert set(invoices[0]) == INVOICE_KEYS


def test_balance_and_patient_responsibility_are_derived(client: TestClient) -> None:
    invoices = client.get("/api/billing/invoices").json()
    therapy = next(i for i in invoices if i["serviceDescription"] == "Therapy session")

    assert therapy["patientResponsibilityCents"] == 15000 - 12000
    assert therapy["balanceCents"] == (15000 - 12000) - 1000


def test_an_open_invoice_past_its_due_date_is_overdue(client: TestClient) -> None:
    invoices = client.get("/api/billing/invoices").json()
    newborn = next(i for i in invoices if i["serviceDescription"] == "Newborn wellness visit")

    assert newborn["status"] == "open"
    assert newborn["overdue"] is True


def test_a_paid_invoice_is_never_overdue_even_past_its_due_date(client: TestClient) -> None:
    invoices = client.get("/api/billing/invoices").json()
    dermatology = next(i for i in invoices if i["serviceDescription"] == "Dermatology follow-up")

    assert dermatology["status"] == "paid"
    assert dermatology["overdue"] is False


def test_filtering_by_status(client: TestClient) -> None:
    paid = client.get("/api/billing/invoices", params={"status": "paid"}).json()
    open_invoices = client.get("/api/billing/invoices", params={"status": "open"}).json()

    assert len(paid) == 1
    assert len(open_invoices) == 4


def test_filtering_by_an_invalid_status_is_a_validation_error(client: TestClient) -> None:
    response = client.get("/api/billing/invoices", params={"status": "not-a-status"})

    assert response.status_code == 422
    assert error_of(response)["field"] == "status"


def test_get_invoice_by_id(client: TestClient) -> None:
    response = client.get("/api/billing/invoices/inv_001")

    assert response.status_code == 200
    assert response.json()["serviceDescription"] == "Annual physical"


def test_get_unknown_invoice_is_not_found(client: TestClient) -> None:
    response = client.get("/api/billing/invoices/inv_does_not_exist")

    assert response.status_code == 404
    assert error_of(response)["field"] == "id"


def test_a_full_payment_marks_the_invoice_paid(client: TestClient) -> None:
    # inv_001 (Annual physical): billed 42000, insurance 33600 -> balance 8400, unpaid.
    response = client.post("/api/billing/invoices/inv_001/payments", json={"amountCents": 8400})

    assert response.status_code == 200
    invoice = response.json()
    assert invoice["status"] == "paid"
    assert invoice["balanceCents"] == 0


def test_a_partial_payment_leaves_the_invoice_open(client: TestClient) -> None:
    response = client.post("/api/billing/invoices/inv_001/payments", json={"amountCents": 1000})

    assert response.status_code == 200
    invoice = response.json()
    assert invoice["status"] == "open"
    assert invoice["balanceCents"] == 8400 - 1000
    assert invoice["amountPaidCents"] == 1000


def test_a_payment_exceeding_the_balance_is_rejected(client: TestClient) -> None:
    response = client.post("/api/billing/invoices/inv_001/payments", json={"amountCents": 999999})

    assert response.status_code == 422
    detail = error_of(response)
    assert detail["code"] == "PAYMENT_EXCEEDS_BALANCE"
    assert detail["field"] == "amountCents"


def test_a_non_positive_payment_is_a_validation_error(client: TestClient) -> None:
    response = client.post("/api/billing/invoices/inv_001/payments", json={"amountCents": 0})

    assert response.status_code == 422
    assert error_of(response)["field"] == "amountCents"


def test_paying_an_already_paid_invoice_is_rejected(client: TestClient) -> None:
    # inv_002 (Dermatology follow-up) is seeded fully paid.
    response = client.post("/api/billing/invoices/inv_002/payments", json={"amountCents": 100})

    assert response.status_code == 409
    assert error_of(response)["code"] == "INVOICE_ALREADY_PAID"


def test_payment_on_an_unknown_invoice_is_not_found(client: TestClient) -> None:
    response = client.post(
        "/api/billing/invoices/inv_does_not_exist/payments", json={"amountCents": 100}
    )

    assert response.status_code == 404
