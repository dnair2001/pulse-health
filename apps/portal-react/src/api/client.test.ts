import { describe, expect, it } from 'vitest';

import { isApiError, request, toApiError, toQueryString } from './client';
import { jsonResponse } from '../test/helpers';

const FALLBACK_MESSAGE = 'Something went wrong. Please try again.';
const OFFLINE_MESSAGE = 'Cannot reach the Pulse Health API. Check that it is running on port 8000.';

function envelope(code: string, message: string, field: string | null = null) {
  return { error: { code, message, field } };
}

function callArgs(index: number): [string, RequestInit | undefined] {
  const call = globalThis.fetchMock.mock.calls[index] as unknown[];
  return [String(call[0]), call[1] as RequestInit | undefined];
}

describe('toApiError', () => {
  it('maps status 0 to NETWORK_ERROR with the offline message', () => {
    expect(toApiError(0, null)).toEqual({
      code: 'NETWORK_ERROR',
      message: OFFLINE_MESSAGE,
      field: null,
      status: 0,
    });
  });

  it('ignores the body entirely when the status is 0', () => {
    expect(toApiError(0, envelope('VALIDATION_ERROR', 'Bad input', 'reason'))).toEqual({
      code: 'NETWORK_ERROR',
      message: OFFLINE_MESSAGE,
      field: null,
      status: 0,
    });
  });

  it('maps a well-formed envelope onto code, message, field and status', () => {
    expect(toApiError(422, envelope('VALIDATION_ERROR', 'Reason is too short.', 'reason'))).toEqual({
      code: 'VALIDATION_ERROR',
      message: 'Reason is too short.',
      field: 'reason',
      status: 422,
    });
  });

  it('keeps every known error code as-is', () => {
    const known = [
      'VALIDATION_ERROR',
      'SLOT_IN_PAST',
      'SLOT_ALREADY_BOOKED',
      'APPOINTMENT_NOT_CANCELLABLE',
      'APPOINTMENT_NOT_RESCHEDULABLE',
      'NOT_FOUND',
    ];

    for (const code of known) {
      expect(toApiError(409, envelope(code, 'nope')).code).toBe(code);
    }
  });

  it('normalises an unrecognised code to UNKNOWN but keeps the message', () => {
    expect(toApiError(500, envelope('TEAPOT_ON_FIRE', 'Kettle exploded'))).toEqual({
      code: 'UNKNOWN',
      message: 'Kettle exploded',
      field: null,
      status: 500,
    });
  });

  it('falls back to the generic message when the envelope message is empty', () => {
    expect(toApiError(409, envelope('SLOT_ALREADY_BOOKED', '')).message).toBe(FALLBACK_MESSAGE);
  });

  it('defaults a missing envelope field to null', () => {
    const body = { error: { code: 'NOT_FOUND', message: 'Gone' } };

    expect(toApiError(404, body).field).toBeNull();
  });

  it('treats an HTML string body as a non-envelope', () => {
    expect(toApiError(502, '<html><body>Bad gateway</body></html>')).toEqual({
      code: 'UNKNOWN',
      message: FALLBACK_MESSAGE,
      field: null,
      status: 502,
    });
  });

  it('treats a null body as a non-envelope and keeps the real status', () => {
    expect(toApiError(503, null)).toEqual({
      code: 'UNKNOWN',
      message: FALLBACK_MESSAGE,
      field: null,
      status: 503,
    });
  });

  it('treats a plain object without an error key as a non-envelope', () => {
    expect(toApiError(400, { message: 'nope' })).toEqual({
      code: 'UNKNOWN',
      message: FALLBACK_MESSAGE,
      field: null,
      status: 400,
    });
  });

  it('treats an error object without a code as a non-envelope', () => {
    expect(toApiError(400, { error: { message: 'nope' } })).toEqual({
      code: 'UNKNOWN',
      message: FALLBACK_MESSAGE,
      field: null,
      status: 400,
    });
  });
});

describe('toQueryString', () => {
  it('returns an empty string for an empty object', () => {
    expect(toQueryString({})).toBe('');
  });

  it('omits undefined, null and empty-string values', () => {
    expect(toQueryString({ a: undefined, b: null, c: '' })).toBe('');
  });

  it('sets scalar values', () => {
    expect(toQueryString({ providerId: 'prv_001' })).toBe('?providerId=prv_001');
  });

  it('appends one entry per array item under the same key', () => {
    expect(toQueryString({ status: ['a', 'b'] })).toBe('?status=a&status=b');
  });

  it('omits an empty array entirely', () => {
    expect(toQueryString({ status: [] })).toBe('');
  });

  it('keeps a false boolean rather than dropping it', () => {
    expect(toQueryString({ includeBooked: false })).toBe('?includeBooked=false');
  });

  it('keeps the number zero rather than dropping it', () => {
    expect(toQueryString({ page: 0 })).toBe('?page=0');
  });

  it('serialises a mix of scalars and lists', () => {
    expect(toQueryString({ scope: 'past', status: ['completed', 'cancelled'], providerId: '' })).toBe(
      '?scope=past&status=completed&status=cancelled',
    );
  });

  it('encodes values that need escaping', () => {
    expect(toQueryString({ from: '2099-01-05T09:00:00Z' })).toBe('?from=2099-01-05T09%3A00%3A00Z');
  });
});

describe('request', () => {
  it('resolves the parsed JSON body on 200', async () => {
    globalThis.fetchMock.mockResolvedValue(jsonResponse([{ id: 'prv_001' }]));

    await expect(request<{ id: string }[]>('/api/providers')).resolves.toEqual([
      { id: 'prv_001' },
    ]);
  });

  it('passes the path straight through to fetch', async () => {
    globalThis.fetchMock.mockResolvedValue(jsonResponse([]));

    await request('/api/slots?providerId=prv_001');

    expect(callArgs(0)[0]).toBe('/api/slots?providerId=prv_001');
  });

  it('resolves null for an empty body such as a 204', async () => {
    globalThis.fetchMock.mockResolvedValue(jsonResponse(null, 204));

    await expect(request('/api/appointments/apt_001')).resolves.toBeNull();
  });

  it('rejects with an ApiError on a 4xx envelope', async () => {
    globalThis.fetchMock.mockResolvedValue(
      jsonResponse(envelope('SLOT_ALREADY_BOOKED', 'That slot was just taken.', 'slotId'), 409),
    );

    await expect(request('/api/appointments')).rejects.toEqual({
      code: 'SLOT_ALREADY_BOOKED',
      message: 'That slot was just taken.',
      field: 'slotId',
      status: 409,
    });
  });

  it('rejects with an UNKNOWN ApiError on a 5xx with no envelope', async () => {
    globalThis.fetchMock.mockResolvedValue(jsonResponse('<html>oops</html>', 500));

    await expect(request('/api/appointments')).rejects.toEqual({
      code: 'UNKNOWN',
      message: FALLBACK_MESSAGE,
      field: null,
      status: 500,
    });
  });

  it('rejects with NETWORK_ERROR when fetch itself throws', async () => {
    globalThis.fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(request('/api/providers')).rejects.toEqual({
      code: 'NETWORK_ERROR',
      message: OFFLINE_MESSAGE,
      field: null,
      status: 0,
    });
  });

  it('sends no headers when there is no body', async () => {
    globalThis.fetchMock.mockResolvedValue(jsonResponse([]));

    await request('/api/providers');

    expect(callArgs(0)[1]?.headers).toBeUndefined();
  });

  it('sets Content-Type: application/json when a body is present', async () => {
    globalThis.fetchMock.mockResolvedValue(jsonResponse({ id: 'apt_001' }));

    await request('/api/appointments', { method: 'POST', body: JSON.stringify({ a: 1 }) });

    const [, init] = callArgs(0);
    expect(init?.method).toBe('POST');
    expect(init?.headers).toEqual({ 'Content-Type': 'application/json' });
  });

  it('merges caller-supplied headers alongside Content-Type', async () => {
    globalThis.fetchMock.mockResolvedValue(jsonResponse({}));

    await request('/api/appointments', { method: 'POST', body: '{}', headers: { 'X-Trace': 'abc' } });

    expect(callArgs(0)[1]?.headers).toEqual({
      'Content-Type': 'application/json',
      'X-Trace': 'abc',
    });
  });

  it('returns the raw text when a 200 body is not valid JSON', async () => {
    globalThis.fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('plain text'),
    } as Response);

    await expect(request('/api/providers')).resolves.toBe('plain text');
  });
});

describe('isApiError', () => {
  it('is true for a value produced by toApiError', () => {
    expect(isApiError(toApiError(404, envelope('NOT_FOUND', 'Gone')))).toBe(true);
  });

  it('is false for a plain Error', () => {
    expect(isApiError(new Error('boom'))).toBe(false);
  });

  it('is false for null', () => {
    expect(isApiError(null)).toBe(false);
  });

  it('is false for an empty object', () => {
    expect(isApiError({})).toBe(false);
  });

  it('is false when only some ApiError keys are present', () => {
    expect(isApiError({ code: 'NOT_FOUND', message: 'Gone' })).toBe(false);
  });
});
