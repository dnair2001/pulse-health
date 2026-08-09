import { describe, expect, it, vi } from 'vitest';

import { providersApi } from './endpoints';
import { jsonResponse, provider } from '../test/helpers';

describe('providersApi', () => {
  it('lists the directory from /api/providers with no query string', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse([provider()]));

    await expect(providersApi.list()).resolves.toEqual([provider()]);
    expect(fetch).toHaveBeenCalledWith('/api/providers', undefined);
  });

  it('fetches one provider by id', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(provider({ id: 'prv_002' })));

    await providersApi.getById('prv_002');

    expect(fetch).toHaveBeenCalledWith('/api/providers/prv_002', undefined);
  });

  it('encodes an id so it cannot address a different endpoint', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(provider()));

    await providersApi.getById('../appointments?x=1');

    expect(fetch).toHaveBeenCalledWith('/api/providers/..%2Fappointments%3Fx%3D1', undefined);
  });
});
