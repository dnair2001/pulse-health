import { describe, expect, it, vi } from 'vitest';

import { request, toApiError } from './client';
import { errorResponse, jsonResponse } from '../test/helpers';

const OFFLINE_MESSAGE = 'Cannot reach the Pulse Health API. Check that it is running on port 8000.';
const FALLBACK_MESSAGE = 'Something went wrong. Please try again.';

describe('toApiError', () => {
  it('maps status 0 onto NETWORK_ERROR', () => {
    expect(toApiError(0, null)).toEqual({
      code: 'NETWORK_ERROR',
      message: OFFLINE_MESSAGE,
      field: null,
      status: 0,
    });
  });

  it('unwraps the error envelope, keeping code, message and field', () => {
    const body = {
      error: {
        code: 'NOT_FOUND',
        message: 'We could not find that provider.',
        field: 'providerId',
      },
    };

    expect(toApiError(404, body)).toEqual({
      code: 'NOT_FOUND',
      message: 'We could not find that provider.',
      field: 'providerId',
      status: 404,
    });
  });

  it('normalises a code it does not know to UNKNOWN but keeps the server message', () => {
    const body = { error: { code: 'TEAPOT', message: 'Server said no.', field: null } };

    expect(toApiError(418, body)).toEqual({
      code: 'UNKNOWN',
      message: 'Server said no.',
      field: null,
      status: 418,
    });
  });

  it('substitutes a fallback message when the envelope carries an empty one', () => {
    const body = { error: { code: 'NOT_FOUND', message: '', field: null } };

    expect(toApiError(404, body).message).toBe(FALLBACK_MESSAGE);
  });

  it('defaults a missing field to null', () => {
    const body = { error: { code: 'VALIDATION_ERROR', message: 'Bad input.' } };

    expect(toApiError(422, body).field).toBeNull();
  });

  it('falls back to UNKNOWN when the body is not an error envelope', () => {
    expect(toApiError(500, 'Internal Server Error')).toEqual({
      code: 'UNKNOWN',
      message: FALLBACK_MESSAGE,
      field: null,
      status: 500,
    });
  });
});

describe('request', () => {
  it('returns the parsed body on success', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse([{ id: 'prv_001' }]));

    await expect(request('/api/providers')).resolves.toEqual([{ id: 'prv_001' }]);
    expect(fetch).toHaveBeenCalledWith('/api/providers', undefined);
  });

  it('returns null for an empty body', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(null));

    await expect(request('/api/providers')).resolves.toBeNull();
  });

  it('rejects with an ApiError built from the envelope', async () => {
    vi.mocked(fetch).mockResolvedValue(
      errorResponse(404, 'NOT_FOUND', 'We could not find that provider.', 'providerId'),
    );

    await expect(request('/api/providers/nope')).rejects.toEqual({
      code: 'NOT_FOUND',
      message: 'We could not find that provider.',
      field: 'providerId',
      status: 404,
    });
  });

  it('rejects with NETWORK_ERROR when fetch itself throws', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(request('/api/providers')).rejects.toEqual({
      code: 'NETWORK_ERROR',
      message: OFFLINE_MESSAGE,
      field: null,
      status: 0,
    });
  });

  it('rejects with UNKNOWN when a 500 body is not an error envelope', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('<html>Internal Server Error</html>'),
    } as Response);

    await expect(request('/api/providers')).rejects.toEqual({
      code: 'UNKNOWN',
      message: FALLBACK_MESSAGE,
      field: null,
      status: 500,
    });
  });
});
