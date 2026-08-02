import type { ApiError, ApiErrorCode, ApiErrorEnvelope } from './types';

const KNOWN_CODES: ApiErrorCode[] = [
  'VALIDATION_ERROR',
  'SLOT_IN_PAST',
  'SLOT_ALREADY_BOOKED',
  'APPOINTMENT_NOT_CANCELLABLE',
  'APPOINTMENT_NOT_RESCHEDULABLE',
  'NOT_FOUND',
];

const FALLBACK_MESSAGE = 'Something went wrong. Please try again.';
const OFFLINE_MESSAGE = 'Cannot reach the Pulse Health API. Check that it is running on port 8000.';

function isEnvelope(body: unknown): body is ApiErrorEnvelope {
  if (typeof body !== 'object' || body === null) {
    return false;
  }
  const error = (body as { error?: unknown }).error;
  return typeof error === 'object' && error !== null && 'code' in error;
}

export function isApiError(value: unknown): value is ApiError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    'message' in value &&
    'field' in value &&
    'status' in value
  );
}

export function toApiError(status: number, body: unknown): ApiError {
  if (status === 0) {
    return { code: 'NETWORK_ERROR', message: OFFLINE_MESSAGE, field: null, status: 0 };
  }

  if (isEnvelope(body)) {
    const { code, message, field } = body.error;
    return {
      code: (KNOWN_CODES as string[]).includes(code) ? (code as ApiErrorCode) : 'UNKNOWN',
      message: message || FALLBACK_MESSAGE,
      field: field ?? null,
      status,
    };
  }

  return { code: 'UNKNOWN', message: FALLBACK_MESSAGE, field: null, status };
}

/**
 * Mirrors the Angular app's query serialisation: single values are set, list
 * values are appended once per entry, and empty lists are omitted entirely.
 */
export function toQueryString(params: Record<string, unknown>): string {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') {
      continue;
    }
    if (Array.isArray(value)) {
      for (const entry of value) {
        search.append(key, String(entry));
      }
      continue;
    }
    search.set(key, String(value));
  }

  const query = search.toString();
  return query ? `?${query}` : '';
}

async function parseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

/** Every rejection from this function is an ApiError, so callers never see a raw Response. */
export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(path, {
      ...init,
      headers:
        init?.body === undefined
          ? init?.headers
          : { 'Content-Type': 'application/json', ...init?.headers },
    });
  } catch {
    throw toApiError(0, null);
  }

  const body = await parseBody(response);

  if (!response.ok) {
    throw toApiError(response.status, body);
  }

  return body as T;
}
