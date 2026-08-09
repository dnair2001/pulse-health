import type { Provider } from '../../api/types';

/**
 * `GET /api/providers` has no search parameter, so the term filters the fetched list here —
 * across name and specialty, case-insensitively, exactly as the Angular getter does.
 */
export function filterProviders(providers: Provider[], search: string): Provider[] {
  const term = search.trim().toLowerCase();
  if (!term) {
    return providers;
  }
  return providers.filter(
    (provider) =>
      provider.name.toLowerCase().includes(term) || provider.specialty.toLowerCase().includes(term),
  );
}
