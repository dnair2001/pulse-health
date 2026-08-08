from datetime import UTC
from typing import Annotated

from fastapi import APIRouter, Query

from app.api.deps import StoreDep
from app.domain.models import (
    Invoice,
    InvoiceRecord,
    InvoiceStatus,
    RecordPaymentRequest,
    StoreData,
)
from app.domain.rules import (
    now_utc,
    parse_invoice_status,
    require_invoice,
    require_provider,
    to_invoice,
    validate_payment_amount,
)

router = APIRouter(tags=["billing"])


def _replace_record(data: StoreData, record: InvoiceRecord) -> None:
    for index, existing in enumerate(data.invoices):
        if existing.id == record.id:
            data.invoices[index] = record
            return


@router.get("/billing/invoices", response_model=list[Invoice])
def list_invoices(
    store: StoreDep,
    status_filter: Annotated[str | None, Query(alias="status")] = None,
) -> list[Invoice]:
    data = store.read()
    status = parse_invoice_status(status_filter)
    today = now_utc().astimezone(UTC).date()
    records = data.invoices
    if status is not None:
        records = [record for record in records if record.status is status]
    return [
        to_invoice(record, require_provider(data.providers, record.provider_id), today)
        for record in records
    ]


@router.get("/billing/invoices/{invoice_id}", response_model=Invoice)
def get_invoice(store: StoreDep, invoice_id: str) -> Invoice:
    data = store.read()
    record = require_invoice(data.invoices, invoice_id)
    today = now_utc().astimezone(UTC).date()
    return to_invoice(record, require_provider(data.providers, record.provider_id), today)


@router.post("/billing/invoices/{invoice_id}/payments", response_model=Invoice)
def record_payment(store: StoreDep, invoice_id: str, payload: RecordPaymentRequest) -> Invoice:
    now = now_utc()
    today = now.astimezone(UTC).date()

    with store.transaction() as data:
        record = require_invoice(data.invoices, invoice_id)
        balance_cents = validate_payment_amount(record, payload.amount_cents)
        provider = require_provider(data.providers, record.provider_id)

        new_amount_paid = record.amount_paid_cents + payload.amount_cents
        new_status = InvoiceStatus.PAID if payload.amount_cents == balance_cents else record.status
        updated = record.model_copy(
            update={
                "amount_paid_cents": new_amount_paid,
                "status": new_status,
                "updated_at": now,
            }
        )
        _replace_record(data, updated)
        return to_invoice(updated, provider, today)
