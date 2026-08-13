import { HttpErrorResponse } from '@angular/common/http';

/** The error codes `docs/api-contract.md` defines. Anything else is reported as `UNKNOWN`. */
const KNOWN_CODES = [
  'VALIDATION_ERROR',
  'SLOT_IN_PAST',
  'SLOT_ALREADY_BOOKED',
  'APPOINTMENT_NOT_CANCELLABLE',
  'APPOINTMENT_NOT_RESCHEDULABLE',
  'NOT_FOUND',
] as const;

const FALLBACK_MESSAGE = 'Something went wrong. Please try again.';

const NETWORK_MESSAGE = 'Cannot reach the Pulse Health API. Check that it is running on port 8000.';

export type ApiErrorCode = (typeof KNOWN_CODES)[number] | 'NETWORK_ERROR' | 'UNKNOWN';

/** The single shape every HTTP failure reaches the UI as. */
export interface ApiError {
  code: ApiErrorCode;
  message: string;
  field: string | null;
  status: number;
}

interface ErrorEnvelope {
  error: { code?: string; message?: string; field?: string | null };
}

function isEnvelope(body: unknown): body is ErrorEnvelope {
  if (typeof body !== 'object' || body === null) {
    return false;
  }
  const { error } = body as { error?: unknown };
  return typeof error === 'object' && error !== null && 'code' in error;
}

function isKnownCode(code: string): code is (typeof KNOWN_CODES)[number] {
  return (KNOWN_CODES as readonly string[]).includes(code);
}

export function toApiError(error: unknown): ApiError {
  // Anything that is not an HTTP response failed before it reached the API -- a throw inside
  // an interceptor, say. Report it as UNKNOWN rather than rendering an internal exception
  // message, which is free text and in a patient-data app can echo user-entered content.
  if (!(error instanceof HttpErrorResponse)) {
    return { code: 'UNKNOWN', message: FALLBACK_MESSAGE, field: null, status: 0 };
  }

  const response = error;

  // HttpClient reports an unreachable server (and a request the browser aborted) as status 0.
  if (response.status === 0) {
    return { code: 'NETWORK_ERROR', message: NETWORK_MESSAGE, field: null, status: 0 };
  }

  if (isEnvelope(response.error)) {
    const { code, message, field } = response.error.error;
    return {
      code: code && isKnownCode(code) ? code : 'UNKNOWN',
      message: message || FALLBACK_MESSAGE,
      field: field ?? null,
      status: response.status,
    };
  }

  return { code: 'UNKNOWN', message: FALLBACK_MESSAGE, field: null, status: response.status };
}
