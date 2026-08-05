import { describe, expect, it, vi } from 'vitest';

import { isApiError, request, shouldRetryQuery, toApiError, toQueryString } from './client';
import { reportEvent } from '../observability/telemetry';
import { errorResponse, jsonResponse } from '../test/helpers';

vi.mock('../observability/telemetry', () => ({
  reportEvent: vi.fn(),
}));

const FALLBACK_MESSAGE = 'Something went wrong. Please try again.';
const OFFLINE_MESSAGE = 'Cannot reach the Pulse Health API. Check that it is running on port 8000.';

describe('toApiError', () => {
  it('reports status 0 as NETWORK_ERROR even when a body is present', () => {
    expect(toApiError(0, { error: { code: 'NOT_FOUND', message: 'gone', field: 'id' } })).toEqual({
      code: 'NETWORK_ERROR',
      message: OFFLINE_MESSAGE,
      field: null,
      status: 0,
    });
  });

  it('keeps the code, message and field of a known-code envelope', () => {
    const body = {
      error: {
        code: 'SLOT_ALREADY_BOOKED',
        message: 'That time slot has just been taken. Please pick another.',
        field: 'slotId',
      },
    };

    expect(toApiError(409, body)).toEqual({
      code: 'SLOT_ALREADY_BOOKED',
      message: 'That time slot has just been taken. Please pick another.',
      field: 'slotId',
      status: 409,
    });
  });

  it('downgrades an unrecognised code to UNKNOWN but keeps the server message', () => {
    const body = { error: { code: 'TEAPOT', message: 'I am a teapot', field: null } };

    expect(toApiError(418, body)).toEqual({
      code: 'UNKNOWN',
      message: 'I am a teapot',
      field: null,
      status: 418,
    });
  });

  it('falls back to UNKNOWN for a non-envelope body while preserving the status', () => {
    expect(toApiError(502, '<html>Bad Gateway</html>')).toEqual({
      code: 'UNKNOWN',
      message: FALLBACK_MESSAGE,
      field: null,
      status: 502,
    });
  });
});

describe('toQueryString', () => {
  it('repeats array values, keeps false, drops undefined and preserves order', () => {
    const search = toQueryString({
      scope: 'upcoming',
      providerId: undefined,
      status: ['scheduled', 'cancelled'],
      includeBooked: false,
    });

    expect(search).toBe('?scope=upcoming&status=scheduled&status=cancelled&includeBooked=false');
    expect(toQueryString({})).toBe('');
  });
});

describe('request', () => {
  it('rejects with an ApiError, not a raw Error, for network and body-read failures', async () => {
    globalThis.fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const networkFailure = await request('/api/providers').catch((error: unknown) => error);

    expect(isApiError(networkFailure)).toBe(true);
    expect(networkFailure).not.toBeInstanceOf(Error);
    expect(networkFailure).toMatchObject({ code: 'NETWORK_ERROR', message: OFFLINE_MESSAGE });

    globalThis.fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: () => Promise.reject(new TypeError('stream closed')),
    } as Response);
    const readFailure = await request('/api/providers').catch((error: unknown) => error);

    expect(isApiError(readFailure)).toBe(true);
    expect(readFailure).toMatchObject({ code: 'NETWORK_ERROR', status: 0 });
  });

  it('rejects with the normalised envelope for a non-2xx response', async () => {
    globalThis.fetchMock.mockResolvedValueOnce(
      errorResponse(422, 'VALIDATION_ERROR', 'Reason is too short.', 'reason'),
    );

    await expect(request('/api/appointments', { method: 'POST', body: '{}' })).rejects.toEqual({
      code: 'VALIDATION_ERROR',
      message: 'Reason is too short.',
      field: 'reason',
      status: 422,
    });
  });

  it('sends Content-Type: application/json only when there is a body', async () => {
    globalThis.fetchMock.mockResolvedValue(jsonResponse([]));

    await request('/api/providers');
    await request('/api/appointments', { method: 'POST', body: JSON.stringify({ id: 'a' }) });

    const [getInit, postInit] = globalThis.fetchMock.mock.calls.map(
      (call: unknown[]) => call[1] as RequestInit,
    );

    expect(new Headers(getInit.headers).get('Content-Type')).toBeNull();
    expect(new Headers(postInit.headers).get('Content-Type')).toBe('application/json');
  });

  const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  it('sets a well-formed X-Request-Id header on every call', async () => {
    globalThis.fetchMock.mockResolvedValue(jsonResponse([]));

    await request('/api/providers');

    const [, init] = globalThis.fetchMock.mock.calls[0] as [string, RequestInit];
    const requestId = new Headers(init.headers).get('X-Request-Id');

    expect(requestId).toMatch(UUID_PATTERN);
  });

  it('generates a distinct id for each call rather than reusing one', async () => {
    globalThis.fetchMock.mockResolvedValue(jsonResponse([]));

    await request('/api/providers');
    await request('/api/providers');

    const [firstInit, secondInit] = globalThis.fetchMock.mock.calls.map(
      (call: unknown[]) => call[1] as RequestInit,
    );
    const firstId = new Headers(firstInit.headers).get('X-Request-Id');
    const secondId = new Headers(secondInit.headers).get('X-Request-Id');

    expect(firstId).toMatch(UUID_PATTERN);
    expect(secondId).toMatch(UUID_PATTERN);
    expect(firstId).not.toBe(secondId);
  });

  it('reports a network failure to telemetry with level error', async () => {
    globalThis.fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await request('/api/providers').catch(() => {});

    expect(reportEvent).toHaveBeenCalledWith(
      'error',
      OFFLINE_MESSAGE,
      expect.objectContaining({ errorCode: 'NETWORK_ERROR' }),
    );
  });

  it('reports a 4xx application error to telemetry with level warn', async () => {
    globalThis.fetchMock.mockResolvedValueOnce(
      errorResponse(422, 'VALIDATION_ERROR', 'Reason is too short.', 'reason'),
    );

    await request('/api/appointments', { method: 'POST', body: '{}' }).catch(() => {});

    expect(reportEvent).toHaveBeenCalledWith(
      'warn',
      'Reason is too short.',
      expect.objectContaining({ errorCode: 'VALIDATION_ERROR' }),
    );
  });

  it('reports a 5xx response to telemetry with level error', async () => {
    globalThis.fetchMock.mockResolvedValueOnce(errorResponse(503, 'UNKNOWN', 'down', null));

    await request('/api/providers').catch(() => {});

    expect(reportEvent).toHaveBeenCalledWith(
      'error',
      'down',
      expect.objectContaining({ errorCode: 'UNKNOWN' }),
    );
  });

  it('passes the request X-Request-Id and current pathname through to telemetry', async () => {
    globalThis.fetchMock.mockResolvedValueOnce(errorResponse(404, 'NOT_FOUND', 'gone', null));

    await request('/api/providers', { headers: { 'X-Request-Id': 'fixed-id' } }).catch(() => {});

    expect(reportEvent).toHaveBeenCalledWith(
      'warn',
      'gone',
      expect.objectContaining({ requestId: 'fixed-id', route: window.location.pathname }),
    );
  });

  it('respects a caller-supplied X-Request-Id instead of overwriting it', async () => {
    globalThis.fetchMock.mockResolvedValue(jsonResponse([]));

    await request('/api/providers', { headers: { 'X-Request-Id': 'caller-supplied-id' } });

    const [, init] = globalThis.fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new Headers(init.headers).get('X-Request-Id')).toBe('caller-supplied-id');
  });
});

describe('shouldRetryQuery', () => {
  it('does not retry a 422 validation-style application error', () => {
    const validationError = toApiError(422, {
      error: { code: 'VALIDATION_ERROR', message: 'Reason is too short.', field: 'reason' },
    });

    expect(shouldRetryQuery(0, validationError)).toBe(false);
  });

  it('does not retry other 4xx application errors, e.g. a 409 conflict', () => {
    const conflictError = toApiError(409, {
      error: { code: 'SLOT_ALREADY_BOOKED', message: 'Taken.', field: 'slotId' },
    });

    expect(shouldRetryQuery(0, conflictError)).toBe(false);
  });

  it('retries a network error', () => {
    const networkError = toApiError(0, null);

    expect(shouldRetryQuery(0, networkError)).toBe(true);
  });

  it('retries a 5xx server error', () => {
    const serverError = toApiError(503, null);

    expect(shouldRetryQuery(0, serverError)).toBe(true);
  });

  it('stops retrying once the failure count reaches the cap, even for a retryable error', () => {
    const networkError = toApiError(0, null);

    expect(shouldRetryQuery(3, networkError)).toBe(false);
  });

  it('does not retry a non-ApiError value', () => {
    expect(shouldRetryQuery(0, new TypeError('boom'))).toBe(false);
  });
});
