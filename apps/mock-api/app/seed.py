"""Builds the demo dataset relative to the current time.

Everything is derived from "now" so a freshly reset store always contains
genuinely future slots, no matter when the mock API is run.
"""

from datetime import UTC, date, datetime, time, timedelta

from app.domain.models import (
    AppointmentRecord,
    AppointmentStatus,
    Provider,
    Slot,
    StoreData,
    VisitType,
    VisitTypeId,
)
from app.domain.rules import now_utc

FUTURE_WINDOW_DAYS = 14
PAST_WINDOW_DAYS = 14
SLOT_MINUTES = 30
BUSINESS_START = time(9, 0)
BUSINESS_LAST_START = time(16, 30)
PAST_SLOT_STARTS = (time(9, 0), time(11, 0), time(14, 0), time(15, 30))

PROVIDERS: tuple[Provider, ...] = (
    Provider(
        id="prv_001",
        name="Dr. Alice Nguyen",
        specialty="Primary Care",
        credentials="MD",
        location_name="Pulse Health Downtown",
        bio=(
            "Dr. Nguyen has practiced primary care in the downtown clinic for over a decade, "
            "with a focus on preventive medicine and chronic disease management."
        ),
    ),
    Provider(
        id="prv_002",
        name="Dr. Marcus Bell",
        specialty="Dermatology",
        credentials="DO",
        location_name="Pulse Health Riverside",
        # Care coordinators write these bios through an internal tool (not part of this
        # demo) that lets them add simple formatting, which is why the Provider Directory
        # renders bio as HTML rather than plain text. Left over from onboarding: nobody
        # has entered a real <strong>/<br> bio for this provider yet, so this one is
        # still the placeholder text a Pulse Health engineer typed in to check that the
        # onboarding tool round-trips markup correctly.
        bio=(
            'Board-certified dermatologist. <img src="x" onerror="alert(\'Reviewed by '
            "Marcus Bell -- update this bio!')\"> Placeholder bio, please replace."
        ),
    ),
    Provider(
        id="prv_003",
        name="Dr. Priya Raman",
        specialty="Pediatrics",
        credentials="MD",
        location_name="Pulse Health Northgate",
        bio=(
            "Dr. Raman sees patients from newborn through adolescence and is fluent in "
            "English, Hindi, and Tamil."
        ),
    ),
    Provider(
        id="prv_004",
        name="Samuel Okafor",
        specialty="Behavioral Health",
        credentials="LCSW",
        location_name="Pulse Health Virtual Care",
        bio=(
            "Samuel is a licensed clinical social worker offering video and phone therapy "
            "sessions, with an emphasis on anxiety and workplace stress."
        ),
    ),
)

VISIT_TYPES: tuple[VisitType, ...] = (
    VisitType(id=VisitTypeId.IN_PERSON, label="In person", duration_minutes=30),
    VisitType(id=VisitTypeId.VIDEO, label="Video visit", duration_minutes=20),
    VisitType(id=VisitTypeId.PHONE, label="Phone call", duration_minutes=15),
)


def slot_id(provider_id: str, starts_at: datetime) -> str:
    return f"slt_{provider_id}_{starts_at.strftime('%Y%m%dT%H%M')}"


def _weekdays(anchor: date, days: int, direction: int) -> list[date]:
    """Weekday dates within `days` calendar days of the anchor, nearest first."""
    result: list[date] = []
    for offset in range(1, days + 1):
        candidate = anchor + timedelta(days=offset * direction)
        if candidate.weekday() < 5:
            result.append(candidate)
    return result


def _day_starts(day: date, first: time, last: time) -> list[datetime]:
    cursor = datetime.combine(day, first, tzinfo=UTC)
    end = datetime.combine(day, last, tzinfo=UTC)
    starts: list[datetime] = []
    while cursor <= end:
        starts.append(cursor)
        cursor += timedelta(minutes=SLOT_MINUTES)
    return starts


def _make_slot(provider_id: str, starts_at: datetime) -> Slot:
    return Slot(
        id=slot_id(provider_id, starts_at),
        provider_id=provider_id,
        starts_at=starts_at,
        ends_at=starts_at + timedelta(minutes=SLOT_MINUTES),
    )


def build_seed(now: datetime | None = None) -> StoreData:
    reference = now or now_utc()
    today = reference.date()

    future_days = _weekdays(today, FUTURE_WINDOW_DAYS, 1)
    past_days = _weekdays(today, PAST_WINDOW_DAYS, -1)

    slots: dict[str, Slot] = {}
    for provider in PROVIDERS:
        for day in future_days:
            for starts_at in _day_starts(day, BUSINESS_START, BUSINESS_LAST_START):
                slot = _make_slot(provider.id, starts_at)
                slots[slot.id] = slot
        for day in past_days:
            for start_time in PAST_SLOT_STARTS:
                slot = _make_slot(provider.id, datetime.combine(day, start_time, tzinfo=UTC))
                slots[slot.id] = slot

    appointments = _build_appointments(reference, slots, future_days, past_days)
    return StoreData(
        providers=list(PROVIDERS),
        visit_types=list(VISIT_TYPES),
        slots=sorted(slots.values(), key=lambda slot: (slot.starts_at, slot.id)),
        appointments=appointments,
    )


def _booked_record(
    appointment_id: str,
    slot: Slot,
    status: AppointmentStatus,
    visit_type: VisitTypeId,
    reason: str,
    created_at: datetime,
) -> AppointmentRecord:
    return AppointmentRecord(
        id=appointment_id,
        provider_id=slot.provider_id,
        slot_id=slot.id,
        starts_at=slot.starts_at,
        ends_at=slot.ends_at,
        status=status,
        visit_type=visit_type,
        reason=reason,
        created_at=created_at,
        updated_at=created_at,
    )


def _build_appointments(
    reference: datetime,
    slots: dict[str, Slot],
    future_days: list[date],
    past_days: list[date],
) -> list[AppointmentRecord]:
    def future_slot(day_index: int, at: time, provider_id: str) -> Slot:
        day = future_days[min(day_index, len(future_days) - 1)]
        return slots[slot_id(provider_id, datetime.combine(day, at, tzinfo=UTC))]

    def past_slot(day_index: int, at: time, provider_id: str) -> Slot:
        day = past_days[min(day_index, len(past_days) - 1)]
        return slots[slot_id(provider_id, datetime.combine(day, at, tzinfo=UTC))]

    planned: tuple[tuple[Slot, AppointmentStatus, VisitTypeId, str], ...] = (
        (
            future_slot(1, time(9, 0), "prv_001"),
            AppointmentStatus.SCHEDULED,
            VisitTypeId.IN_PERSON,
            "Annual physical",
        ),
        (
            future_slot(3, time(11, 0), "prv_002"),
            AppointmentStatus.SCHEDULED,
            VisitTypeId.VIDEO,
            "Follow-up on skin treatment",
        ),
        (
            future_slot(5, time(14, 30), "prv_004"),
            AppointmentStatus.SCHEDULED,
            VisitTypeId.PHONE,
            "Therapy check-in",
        ),
        (
            past_slot(4, time(11, 0), "prv_001"),
            AppointmentStatus.COMPLETED,
            VisitTypeId.IN_PERSON,
            "Persistent cough",
        ),
        (
            past_slot(7, time(9, 0), "prv_003"),
            AppointmentStatus.COMPLETED,
            VisitTypeId.VIDEO,
            "Newborn wellness visit",
        ),
        (
            past_slot(2, time(14, 0), "prv_002"),
            AppointmentStatus.CANCELLED,
            VisitTypeId.PHONE,
            "Rash consultation",
        ),
    )

    records: list[AppointmentRecord] = []
    for sequence, (slot, status, visit_type, reason) in enumerate(planned, start=1):
        created_at = min(slot.starts_at, reference) - timedelta(days=3)
        records.append(
            _booked_record(f"apt_{sequence:03d}", slot, status, visit_type, reason, created_at)
        )
        # Rule 5 parity: a cancelled appointment must leave its slot free.
        slots[slot.id] = slot.model_copy(
            update={"is_booked": status is not AppointmentStatus.CANCELLED}
        )

    return records
