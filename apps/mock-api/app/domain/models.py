from datetime import UTC, date, datetime
from enum import StrEnum
from typing import Annotated

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    PlainSerializer,
    ValidatorFunctionWrapHandler,
    WrapValidator,
)
from pydantic.alias_generators import to_camel


def _as_utc(value: object, handler: ValidatorFunctionWrapHandler) -> datetime:
    parsed: datetime = handler(value)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=UTC)
    return parsed.astimezone(UTC).replace(microsecond=0)


def _to_iso_z(value: datetime) -> str:
    return value.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


# The frozen contract requires UTC, second-precision, Z-suffixed timestamps; the
# wrap validator also normalises naive input so equality checks stay meaningful.
UtcDateTime = Annotated[
    datetime,
    WrapValidator(_as_utc),
    PlainSerializer(_to_iso_z, return_type=str, when_used="json"),
]


class ApiModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class AppointmentStatus(StrEnum):
    SCHEDULED = "scheduled"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class VisitTypeId(StrEnum):
    IN_PERSON = "in_person"
    VIDEO = "video"
    PHONE = "phone"


class AppointmentScope(StrEnum):
    UPCOMING = "upcoming"
    PAST = "past"


class Provider(ApiModel):
    id: str
    name: str
    specialty: str
    credentials: str
    location_name: str
    # Free text a care coordinator enters for the public Provider Directory profile.
    # Not shown anywhere on the appointments booking flow, hence its absence from
    # ProviderSummary below.
    bio: str = ""


class ProviderSummary(ApiModel):
    """The provider projection embedded in an appointment; omits credentials."""

    id: str
    name: str
    specialty: str
    location_name: str


class VisitType(ApiModel):
    id: VisitTypeId
    label: str
    duration_minutes: int


class Slot(ApiModel):
    id: str
    provider_id: str
    starts_at: UtcDateTime
    ends_at: UtcDateTime
    is_booked: bool = False


class AppointmentRecord(ApiModel):
    """What is persisted: no derived fields, so nothing can go stale on disk."""

    id: str
    provider_id: str
    slot_id: str
    starts_at: UtcDateTime
    ends_at: UtcDateTime
    status: AppointmentStatus
    visit_type: VisitTypeId
    reason: str
    created_at: UtcDateTime
    updated_at: UtcDateTime


class Appointment(ApiModel):
    id: str
    provider_id: str
    provider: ProviderSummary
    slot_id: str
    starts_at: UtcDateTime
    ends_at: UtcDateTime
    status: AppointmentStatus
    visit_type: VisitTypeId
    reason: str
    cancellable: bool
    created_at: UtcDateTime
    updated_at: UtcDateTime


class Patient(ApiModel):
    """The single patient this demo portal represents.

    There is no auth, so exactly one record exists and every `/patients/me`
    request resolves to it.
    """

    id: str
    name: str
    date_of_birth: date
    ssn: str
    insurance_member_id: str
    email: str
    phone: str
    address_line: str
    city: str
    state: str
    postal_code: str
    emergency_contact_name: str
    emergency_contact_phone: str


class PatientProfile(ApiModel):
    """What the profile page renders: `ssn` never leaves the server unmasked."""

    id: str
    name: str
    date_of_birth: date
    ssn_last4: str
    email: str
    phone: str
    address_line: str
    city: str
    state: str
    postal_code: str
    emergency_contact_name: str
    emergency_contact_phone: str


class UpdatePatientProfileRequest(ApiModel):
    """Only contact/demographic details are editable; identity fields are not."""

    email: str = Field(examples=["jordan.reyes@example.com"])
    phone: str = Field(examples=["555-201-3390"])
    address_line: str = Field(examples=["482 Alder Street"])
    city: str = Field(examples=["Rivertown"])
    state: str = Field(examples=["WA"])
    postal_code: str = Field(examples=["98033"])
    emergency_contact_name: str = Field(examples=["Sam Reyes"])
    emergency_contact_phone: str = Field(examples=["555-201-9981"])


class VerifyIdentityResponse(ApiModel):
    verified: bool
    insurance_member_id: str


class StoreData(ApiModel):
    providers: list[Provider]
    patients: list[Patient]
    visit_types: list[VisitType]
    slots: list[Slot]
    appointments: list[AppointmentRecord]


class CreateAppointmentRequest(ApiModel):
    """Values are validated in app.domain.rules so every message is UI-ready."""

    provider_id: str = Field(examples=["prv_001"])
    slot_id: str = Field(examples=["slt_prv_001_20260803T0900"])
    visit_type: str = Field(examples=[v.value for v in VisitTypeId])
    reason: str = Field(examples=["Annual physical"])


class RescheduleAppointmentRequest(ApiModel):
    slot_id: str = Field(examples=["slt_prv_001_20260804T0930"])


class ResetResponse(BaseModel):
    status: str
