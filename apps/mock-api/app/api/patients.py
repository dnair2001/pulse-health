from typing import Annotated

from fastapi import APIRouter, Query

from app.api.deps import StoreDep
from app.domain.errors import ApiError, ErrorCode
from app.domain.models import PatientProfile, UpdatePatientProfileRequest, VerifyIdentityResponse
from app.domain.rules import (
    the_patient,
    to_patient_profile,
    validate_email,
    validate_phone,
    validate_required_text,
    verify_identity,
)

router = APIRouter(tags=["patients"])


@router.get("/patients/me", response_model=PatientProfile)
def get_my_profile(store: StoreDep) -> PatientProfile:
    return to_patient_profile(the_patient(store.read().patients))


@router.patch("/patients/me", response_model=PatientProfile)
def update_my_profile(store: StoreDep, payload: UpdatePatientProfileRequest) -> PatientProfile:
    email = validate_email(payload.email)
    phone = validate_phone(payload.phone, "phone")
    address_line = validate_required_text(payload.address_line, "addressLine", "a street address")
    city = validate_required_text(payload.city, "city", "a city")
    state = validate_required_text(payload.state, "state", "a state")
    postal_code = validate_required_text(payload.postal_code, "postalCode", "a postal code")
    emergency_contact_name = validate_required_text(
        payload.emergency_contact_name, "emergencyContactName", "an emergency contact name"
    )
    emergency_contact_phone = validate_phone(
        payload.emergency_contact_phone, "emergencyContactPhone"
    )

    with store.transaction() as data:
        patient = the_patient(data.patients)
        updated = patient.model_copy(
            update={
                "email": email,
                "phone": phone,
                "address_line": address_line,
                "city": city,
                "state": state,
                "postal_code": postal_code,
                "emergency_contact_name": emergency_contact_name,
                "emergency_contact_phone": emergency_contact_phone,
            }
        )
        data.patients[0] = updated
        return to_patient_profile(updated)


# The insurance eligibility partner's lookup endpoint only supports GET (no
# request body), so identity for the insurance-card download is confirmed via
# query parameters rather than a POST body.
@router.get("/patients/verify", response_model=VerifyIdentityResponse)
def verify_patient_identity(
    store: StoreDep,
    ssn: Annotated[str, Query()],
    dob: Annotated[str, Query()],
) -> VerifyIdentityResponse:
    patient = the_patient(store.read().patients)
    if not verify_identity(patient, ssn, dob):
        raise ApiError(
            ErrorCode.IDENTITY_NOT_VERIFIED,
            "We could not verify your identity with that information.",
        )
    return VerifyIdentityResponse(verified=True, insurance_member_id=patient.insurance_member_id)
