/**
 * Codes this app can currently receive. The API's full set is wider (see
 * docs/api-contract.md); it grows here as each feature slice is ported, and anything
 * unrecognised normalises to `UNKNOWN` rather than leaking through untyped.
 */
export type ApiErrorCode = 'VALIDATION_ERROR' | 'NOT_FOUND' | 'NETWORK_ERROR' | 'UNKNOWN';

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

/**
 * The projection embedded in appointments, prescriptions and invoices. It has no
 * `credentials` and no `bio`; `Provider` below is the directory's own, larger shape.
 */
export interface ProviderSummary {
  id: string;
  name: string;
  specialty: string;
  locationName: string;
}

export interface Provider extends ProviderSummary {
  credentials: string;
  bio: string;
}
