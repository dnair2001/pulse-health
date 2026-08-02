from typing import Annotated

from fastapi import APIRouter, Query, status

from app.api.deps import StoreDep
from app.domain.models import (
    Appointment,
    AppointmentRecord,
    AppointmentStatus,
    CreateAppointmentRequest,
    RescheduleAppointmentRequest,
    Slot,
    StoreData,
)
from app.domain.rules import (
    ensure_cancellable,
    ensure_reschedulable,
    ensure_slot_belongs_to_provider,
    ensure_slot_bookable,
    next_appointment_id,
    now_utc,
    parse_scope,
    parse_statuses,
    parse_visit_type,
    parse_visit_types,
    require_appointment,
    require_provider,
    require_slot,
    select_appointments,
    to_appointment,
    validate_reason,
)

router = APIRouter(tags=["appointments"])


def _set_slot_booked(data: StoreData, slot_id: str, is_booked: bool) -> None:
    for index, slot in enumerate(data.slots):
        if slot.id == slot_id:
            data.slots[index] = slot.model_copy(update={"is_booked": is_booked})
            return


def _replace_record(data: StoreData, record: AppointmentRecord) -> None:
    for index, existing in enumerate(data.appointments):
        if existing.id == record.id:
            data.appointments[index] = record
            return


def _expand(data: StoreData, record: AppointmentRecord) -> Appointment:
    return to_appointment(record, require_provider(data.providers, record.provider_id), now_utc())


@router.get("/appointments", response_model=list[Appointment])
def list_appointments(
    store: StoreDep,
    scope: Annotated[str | None, Query()] = None,
    status_filter: Annotated[list[str] | None, Query(alias="status")] = None,
    visit_type_filter: Annotated[list[str] | None, Query(alias="visitType")] = None,
    provider_id: Annotated[str | None, Query(alias="providerId")] = None,
) -> list[Appointment]:
    data = store.read()
    now = now_utc()
    records = select_appointments(
        data.appointments,
        now=now,
        scope=parse_scope(scope),
        statuses=parse_statuses(status_filter),
        visit_types=parse_visit_types(visit_type_filter),
        provider_id=provider_id,
    )
    return [
        to_appointment(record, require_provider(data.providers, record.provider_id), now)
        for record in records
    ]


@router.get("/appointments/{appointment_id}", response_model=Appointment)
def get_appointment(store: StoreDep, appointment_id: str) -> Appointment:
    data = store.read()
    return _expand(data, require_appointment(data.appointments, appointment_id))


@router.post(
    "/appointments",
    response_model=Appointment,
    status_code=status.HTTP_201_CREATED,
)
def create_appointment(store: StoreDep, payload: CreateAppointmentRequest) -> Appointment:
    reason = validate_reason(payload.reason)
    visit_type = parse_visit_type(payload.visit_type)
    now = now_utc()

    with store.transaction() as data:
        provider = require_provider(data.providers, payload.provider_id)
        slot: Slot = require_slot(data.slots, payload.slot_id)
        ensure_slot_belongs_to_provider(slot, provider.id)
        ensure_slot_bookable(slot, now)

        record = AppointmentRecord(
            id=next_appointment_id(data.appointments),
            provider_id=provider.id,
            slot_id=slot.id,
            starts_at=slot.starts_at,
            ends_at=slot.ends_at,
            status=AppointmentStatus.SCHEDULED,
            visit_type=visit_type,
            reason=reason,
            created_at=now,
            updated_at=now,
        )
        data.appointments.append(record)
        _set_slot_booked(data, slot.id, True)
        return to_appointment(record, provider, now)


@router.patch("/appointments/{appointment_id}", response_model=Appointment)
def reschedule_appointment(
    store: StoreDep,
    appointment_id: str,
    payload: RescheduleAppointmentRequest,
) -> Appointment:
    now = now_utc()

    with store.transaction() as data:
        record = require_appointment(data.appointments, appointment_id)
        ensure_reschedulable(record)
        provider = require_provider(data.providers, record.provider_id)
        new_slot = require_slot(data.slots, payload.slot_id)

        # The target slot is validated while the old one is still held, so
        # rescheduling onto the appointment's own slot reports it as booked.
        ensure_slot_belongs_to_provider(new_slot, record.provider_id)
        ensure_slot_bookable(new_slot, now)
        _set_slot_booked(data, record.slot_id, False)
        _set_slot_booked(data, new_slot.id, True)

        updated = record.model_copy(
            update={
                "slot_id": new_slot.id,
                "starts_at": new_slot.starts_at,
                "ends_at": new_slot.ends_at,
                "updated_at": now,
            }
        )
        _replace_record(data, updated)
        return to_appointment(updated, provider, now)


@router.post("/appointments/{appointment_id}/cancel", response_model=Appointment)
def cancel_appointment(store: StoreDep, appointment_id: str) -> Appointment:
    now = now_utc()

    with store.transaction() as data:
        record = require_appointment(data.appointments, appointment_id)
        ensure_cancellable(record)
        provider = require_provider(data.providers, record.provider_id)

        updated = record.model_copy(
            update={"status": AppointmentStatus.CANCELLED, "updated_at": now}
        )
        _replace_record(data, updated)
        _set_slot_booked(data, record.slot_id, False)
        return to_appointment(updated, provider, now)
