export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'SLOT_IN_PAST'
  | 'SLOT_ALREADY_BOOKED'
  | 'APPOINTMENT_NOT_CANCELLABLE'
  | 'APPOINTMENT_NOT_RESCHEDULABLE'
  | 'NOT_FOUND'
  | 'IDENTITY_NOT_VERIFIED'
  | 'PRESCRIPTION_NOT_REFILLABLE'
  | 'NO_REFILLS_REMAINING'
  | 'NETWORK_ERROR'
  | 'UNKNOWN';

/** Normalised form of the API's `{"error": {...}}` envelope, plus the HTTP status. */
export interface ApiError {
  code: ApiErrorCode;
  message: string;
  field: string | null;
  status: number;
}

export interface ApiErrorEnvelope {
  error: {
    code: string;
    message: string;
    field: string | null;
  };
}
