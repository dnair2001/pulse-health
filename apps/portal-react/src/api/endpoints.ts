import { request } from './client';
import type { Provider } from './types';

/**
 * Port of ProviderDirectoryService. `GET /api/providers` takes no search parameter — the
 * directory filters the full list client-side — so there is nothing to serialise here.
 */
export const providersApi = {
  list: () => request<Provider[]>('/api/providers'),

  // The id comes straight off the URL, so it is encoded rather than interpolated raw: an id
  // containing `/` or `?` would otherwise address a different endpoint entirely.
  getById: (id: string) => request<Provider>(`/api/providers/${encodeURIComponent(id)}`),
};
