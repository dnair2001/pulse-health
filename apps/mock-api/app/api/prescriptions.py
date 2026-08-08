from typing import Annotated

from fastapi import APIRouter, Query

from app.api.deps import StoreDep
from app.domain.models import Prescription, PrescriptionRecord, StoreData
from app.domain.rules import (
    ensure_refillable,
    now_utc,
    parse_prescription_status,
    require_prescription,
    require_provider,
    to_prescription,
)

router = APIRouter(tags=["prescriptions"])


def _replace_record(data: StoreData, record: PrescriptionRecord) -> None:
    for index, existing in enumerate(data.prescriptions):
        if existing.id == record.id:
            data.prescriptions[index] = record
            return


@router.get("/prescriptions", response_model=list[Prescription])
def list_prescriptions(
    store: StoreDep,
    status_filter: Annotated[str | None, Query(alias="status")] = None,
) -> list[Prescription]:
    data = store.read()
    status = parse_prescription_status(status_filter)
    records = data.prescriptions
    if status is not None:
        records = [record for record in records if record.status is status]
    return [
        to_prescription(record, require_provider(data.providers, record.provider_id))
        for record in records
    ]


@router.get("/prescriptions/{prescription_id}", response_model=Prescription)
def get_prescription(store: StoreDep, prescription_id: str) -> Prescription:
    data = store.read()
    record = require_prescription(data.prescriptions, prescription_id)
    return to_prescription(record, require_provider(data.providers, record.provider_id))


@router.post("/prescriptions/{prescription_id}/refill-request", response_model=Prescription)
def request_refill(store: StoreDep, prescription_id: str) -> Prescription:
    now = now_utc()

    with store.transaction() as data:
        record = require_prescription(data.prescriptions, prescription_id)
        ensure_refillable(record)
        provider = require_provider(data.providers, record.provider_id)

        updated = record.model_copy(
            update={
                "refills_remaining": record.refills_remaining - 1,
                "last_filled_at": now,
                "updated_at": now,
            }
        )
        _replace_record(data, updated)
        return to_prescription(updated, provider)
