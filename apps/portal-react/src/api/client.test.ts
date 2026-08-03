import { describe, expect, it } from 'vitest';

import { isApiError, request, toApiError, toQueryString } from './client';
import { errorResponse, jsonResponse } from '../test/helpers';

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
});
