import { useQuery } from '@tanstack/react-query';

import { providersApi } from './endpoints';
import type { ApiError, Provider } from './types';

export const queryKeys = {
  providers: ['providers'] as const,
  provider: (id: string) => ['provider', id] as const,
};

// `request()` rejects with an ApiError and nothing else, so the error type is pinned here
// rather than left as the default `Error` and re-narrowed in every component.
export function useProviders() {
  return useQuery<Provider[], ApiError>({
    queryKey: queryKeys.providers,
    queryFn: providersApi.list,
  });
}

export function useProvider(id: string | undefined) {
  return useQuery<Provider, ApiError>({
    queryKey: queryKeys.provider(id ?? ''),
    queryFn: () => providersApi.getById(id as string),
    enabled: Boolean(id),
  });
}
