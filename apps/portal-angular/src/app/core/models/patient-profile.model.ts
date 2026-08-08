export interface PatientProfile {
  id: string;
  name: string;
  dateOfBirth: string;
  ssnLast4: string;
  email: string;
  phone: string;
  addressLine: string;
  city: string;
  state: string;
  postalCode: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
}

export interface UpdatePatientProfileRequest {
  email: string;
  phone: string;
  addressLine: string;
  city: string;
  state: string;
  postalCode: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
}

export interface VerifyIdentityResult {
  verified: boolean;
  insuranceMemberId: string;
}
