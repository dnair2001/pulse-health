from collections.abc import Iterable, Sequence
from datetime import UTC, datetime

from app.domain.errors import ApiError, ErrorCode, not_found, validation_error
from app.domain.models import (
    Appointment,
    AppointmentRecord,
    AppointmentScope,
    AppointmentStatus,
    Provider,
    ProviderSummary,
    Slot,
    VisitTypeId,
)

REASON_MIN_LENGTH = 3
REASON_MAX_LENGTH = 500

_APPOINTMENT_ID_PREFIX = "apt_"


def now_utc() -> datetime:
    return datetime.now(UTC).replace(microsecond=0)


def to_utc(value: datetime | None) -> datetime | None:
    """Query bounds may arrive without an offset; treat those as UTC."""
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def _join(values: Iterable[str]) -> str:
    return ", ".join(values)


def validate_reason(raw: str) -> str:
    reason = raw.strip()
    if not reason:
        raise validation_error("Please tell us the reason for your visit.", "reason")
    if len(reason) < REASON_MIN_LENGTH:
        raise validation_error(
            f"Please describe the reason in at least {REASON_MIN_LENGTH} characters.",
            "reason",
        )
    if len(reason) > REASON_MAX_LENGTH:
        raise validation_error(
            f"Please keep the reason to {REASON_MAX_LENGTH} characters or fewer.",
            "reason",
        )
    return reason


def parse_visit_type(raw: str, field: str = "visitType") -> VisitTypeId:
    try:
        return VisitTypeId(raw)
    except ValueError:
        raise validation_error(
            f"'{raw}' is not a supported visit type. Choose one of: "
            f"{_join(v.value for v in VisitTypeId)}.",
            field,
        ) from None


def parse_status(raw: str, field: str = "status") -> AppointmentStatus:
    try:
        return AppointmentStatus(raw)
    except ValueError:
        raise validation_error(
            f"'{raw}' is not a valid appointment status. Choose one of: "
            f"{_join(s.value for s in AppointmentStatus)}.",
            field,
        ) from None


def parse_scope(raw: str | None, field: str = "scope") -> AppointmentScope | None:
    if raw is None:
        return None
    try:
        return AppointmentScope(raw)
    except ValueError:
        raise validation_error(
            f"'{raw}' is not a valid scope. Choose one of: "
            f"{_join(s.value for s in AppointmentScope)}.",
            field,
        ) from None


def parse_statuses(raw: Sequence[str] | None) -> list[AppointmentStatus]:
    return [parse_status(value) for value in raw or []]


def parse_visit_types(raw: Sequence[str] | None) -> list[VisitTypeId]:
    return [parse_visit_type(value, "visitType") for value in raw or []]


def is_cancellable(status: AppointmentStatus, starts_at: datetime, now: datetime) -> bool:
    return status is AppointmentStatus.SCHEDULED and starts_at > now


def to_summary(provider: Provider) -> ProviderSummary:
    return ProviderSummary(
        id=provider.id,
        name=provider.name,
        specialty=provider.specialty,
        location_name=provider.location_name,
    )


def to_appointment(record: AppointmentRecord, provider: Provider, now: datetime) -> Appointment:
    return Appointment(
        id=record.id,
        provider_id=record.provider_id,
        provider=to_summary(provider),
        slot_id=record.slot_id,
        starts_at=record.starts_at,
        ends_at=record.ends_at,
        status=record.status,
        visit_type=record.visit_type,
        reason=record.reason,
        cancellable=is_cancellable(record.status, record.starts_at, now),
        created_at=record.created_at,
        updated_at=record.updated_at,
    )


def require_provider(providers: Sequence[Provider], provider_id: str) -> Provider:
    for provider in providers:
        if provider.id == provider_id:
            return provider
    raise not_found("We could not find that provider.", "providerId")


def require_slot(slots: Sequence[Slot], slot_id: str) -> Slot:
    for slot in slots:
        if slot.id == slot_id:
            return slot
    raise not_found("We could not find that time slot.", "slotId")


def require_appointment(
    records: Sequence[AppointmentRecord], appointment_id: str
) -> AppointmentRecord:
    for record in records:
        if record.id == appointment_id:
            return record
    raise not_found("We could not find that appointment.", "id")


def ensure_slot_belongs_to_provider(slot: Slot, provider_id: str) -> None:
    if slot.provider_id != provider_id:
        raise validation_error(
            "That time slot belongs to a different provider.",
            "slotId",
        )


def ensure_slot_bookable(slot: Slot, now: datetime) -> None:
    if slot.starts_at <= now:
        raise ApiError(
            ErrorCode.SLOT_IN_PAST,
            "That time slot is in the past. Please pick a later time.",
            "slotId",
        )
    if slot.is_booked:
        raise ApiError(
            ErrorCode.SLOT_ALREADY_BOOKED,
            "That time slot has just been taken. Please pick another.",
            "slotId",
        )


def ensure_cancellable(record: AppointmentRecord) -> None:
    if record.status is AppointmentStatus.CANCELLED:
        raise ApiError(
            ErrorCode.APPOINTMENT_NOT_CANCELLABLE,
            "This appointment has already been cancelled.",
        )
    if record.status is not AppointmentStatus.SCHEDULED:
        raise ApiError(
            ErrorCode.APPOINTMENT_NOT_CANCELLABLE,
            "This appointment has already taken place and can no longer be cancelled.",
        )


def ensure_reschedulable(record: AppointmentRecord) -> None:
    if record.status is AppointmentStatus.CANCELLED:
        raise ApiError(
            ErrorCode.APPOINTMENT_NOT_RESCHEDULABLE,
            "This appointment has been cancelled, so it can no longer be rescheduled.",
        )
    if record.status is not AppointmentStatus.SCHEDULED:
        raise ApiError(
            ErrorCode.APPOINTMENT_NOT_RESCHEDULABLE,
            "This appointment has already taken place and can no longer be rescheduled.",
        )


def select_slots(
    slots: Iterable[Slot],
    now: datetime,
    provider_id: str | None = None,
    starts_from: datetime | None = None,
    starts_to: datetime | None = None,
    include_booked: bool = False,
) -> list[Slot]:
    selected = [
        slot
        for slot in slots
        if slot.starts_at > now
        and (include_booked or not slot.is_booked)
        and (provider_id is None or slot.provider_id == provider_id)
        and (starts_from is None or slot.starts_at >= starts_from)
        and (starts_to is None or slot.starts_at <= starts_to)
    ]
    return sorted(selected, key=lambda slot: (slot.starts_at, slot.id))


def is_upcoming(record: AppointmentRecord, now: datetime) -> bool:
    return record.status is AppointmentStatus.SCHEDULED and record.starts_at >= now


def select_appointments(
    records: Iterable[AppointmentRecord],
    now: datetime,
    scope: AppointmentScope | None = None,
    statuses: Sequence[AppointmentStatus] = (),
    visit_types: Sequence[VisitTypeId] = (),
    provider_id: str | None = None,
) -> list[AppointmentRecord]:
    selected = [
        record
        for record in records
        if (provider_id is None or record.provider_id == provider_id)
        and (not statuses or record.status in statuses)
        and (not visit_types or record.visit_type in visit_types)
        and (scope is None or (scope is AppointmentScope.UPCOMING) == is_upcoming(record, now))
    ]
    descending = scope is AppointmentScope.PAST
    selected.sort(key=lambda record: (record.starts_at, record.id), reverse=descending)
    return selected


def next_appointment_id(records: Iterable[AppointmentRecord]) -> str:
    highest = 0
    for record in records:
        suffix = record.id.removeprefix(_APPOINTMENT_ID_PREFIX)
        if suffix.isdigit():
            highest = max(highest, int(suffix))
    return f"{_APPOINTMENT_ID_PREFIX}{highest + 1:03d}"
