import type { ApiError, ApiErrorCode, ApiErrorEnvelope } from './types';

/**
 * Codes the API is known to send. A code outside this list still reaches the UI, but as
 * `UNKNOWN`, so a new server-side code can never be mistaken for one the UI branches on.
 */
const KNOWN_CODES: ApiErrorCode[] = ['VALIDATION_ERROR', 'NOT_FOUND'];

const FALLBACK_MESSAGE = 'Something went wrong. Please try again.';
const OFFLINE_MESSAGE = 'Cannot reach the Pulse Health API. Check that it is running on port 8000.';

function isEnvelope(body: unknown): body is ApiErrorEnvelope {
  if (typeof body !== 'object' || body === null) {
    return false;
  }
  const error = (body as { error?: unknown }).error;
  return typeof error === 'object' && error !== null && 'code' in error;
}

/** Status 0 stands for "the request never reached the API", matching Angular's HttpErrorResponse. */
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

/**
 * The React equivalent of Angular's `ApiErrorInterceptor`: every rejection from here is an
 * ApiError, so no caller ever sees a raw Response or a fetch TypeError.
 */
export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(path, init);
  } catch {
    throw toApiError(0, null);
  }

  const body = await parseBody(response);

  if (!response.ok) {
    throw toApiError(response.status, body);
  }

  return body as T;
}
