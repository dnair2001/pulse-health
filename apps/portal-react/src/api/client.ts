import type { ApiError, ApiErrorCode, ApiErrorEnvelope } from './types';

/** Codes the API is contracted to send. Anything else is reported as `UNKNOWN`. */
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

export function isApiError(value: unknown): value is ApiError {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Partial<ApiError>;
  return (
    typeof candidate.code === 'string' &&
    typeof candidate.message === 'string' &&
    typeof candidate.status === 'number' &&
    (candidate.field === null || typeof candidate.field === 'string')
  );
}

/**
 * TanStack Query `retry` predicate for queries: retry only failures a retry can
 * plausibly fix, a network blip (`NETWORK_ERROR`, `status: 0`) or a 5xx from the API.
 * Application errors surfaced as typed codes (`VALIDATION_ERROR`, `SLOT_ALREADY_BOOKED`,
 * ...) are 4xx and deterministic for the same request, so retrying them just delays
 * showing the user what already failed. Capped at 3 attempts; TanStack Query's default
 * exponential backoff applies between them.
 */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (failureCount >= 3) {
    return false;
  }
  if (!isApiError(error)) {
    return false;
  }
  return error.code === 'NETWORK_ERROR' || error.status >= 500;
}

/**
 * Serialises query parameters the way the Angular services did: array values are
 * repeated (`?status=a&status=b`), a `false` boolean is still sent, and empty strings
 * are dropped to match the Angular `if (query.providerId)` guards. Insertion order of
 * `params` is preserved, so callers control parameter order.
 */
export function toQueryString(
  params: Record<string, string | string[] | boolean | undefined>,
): string {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') {
      continue;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        search.append(key, item);
      }
      continue;
    }
    search.append(key, String(value));
  }

  const serialised = search.toString();
  return serialised === '' ? '' : `?${serialised}`;
}

const REQUEST_ID_HEADER = 'X-Request-Id';

/**
 * The single place the app talks to the API. It replaces Angular's
 * `ApiErrorInterceptor`: every rejection from here is an `ApiError`, never a
 * `TypeError` from `fetch` or a `SyntaxError` from a malformed body.
 */
export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const hasBody = init.body !== undefined && init.body !== null;
  if (hasBody && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  // A fresh id per call, not one shared for the app's lifetime, is what lets a single
  // browser action be correlated to a single server log line. Respect a caller-supplied
  // id (mirrors the API's own "use it if present" behaviour) instead of overwriting it.
  if (!headers.has(REQUEST_ID_HEADER)) {
    headers.set(REQUEST_ID_HEADER, crypto.randomUUID());
  }

  let response: Response;
  try {
    response = await fetch(path, { ...init, headers });
  } catch {
    throw toApiError(0, null);
  }

  let raw: string;
  try {
    raw = await response.text();
  } catch {
    // The status arrived but the stream broke, so this is a transport failure.
    throw toApiError(0, null);
  }

  let body: unknown = null;
  if (raw !== '') {
    try {
      body = JSON.parse(raw) as unknown;
    } catch {
      throw toApiError(response.status, raw);
    }
  }

  if (!response.ok) {
    throw toApiError(response.status, body);
  }

  return body as T;
}
