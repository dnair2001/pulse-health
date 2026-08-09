import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { useProvider, useProviders } from './queries';
import { createTestQueryClient, errorResponse, jsonResponse, provider } from '../test/helpers';

/** One client per test, built outside the wrapper so a re-render never resets the cache. */
function createWrapper() {
  const queryClient = createTestQueryClient();
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useProviders', () => {
  it('resolves the directory list', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse([provider()]));

    const { result } = renderHook(() => useProviders(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.data).toEqual([provider()]));
  });

  it('surfaces the normalised ApiError rather than a raw Response', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse('boom', 500));

    const { result } = renderHook(() => useProviders(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error).toEqual({
      code: 'UNKNOWN',
      message: 'Something went wrong. Please try again.',
      field: null,
      status: 500,
    });
  });
});

describe('useProvider', () => {
  it('fetches the requested provider', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(provider({ id: 'prv_002' })));

    const { result } = renderHook(() => useProvider('prv_002'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.data?.id).toBe('prv_002'));
  });

  it('exposes the NOT_FOUND error for an unknown id', async () => {
    vi.mocked(fetch).mockResolvedValue(
      errorResponse(404, 'NOT_FOUND', 'We could not find that provider.', 'providerId'),
    );

    const { result } = renderHook(() => useProvider('prv_nope'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.error?.code).toBe('NOT_FOUND'));
  });

  it('stays disabled, and issues no request, without an id', () => {
    const { result } = renderHook(() => useProvider(undefined), { wrapper: createWrapper() });

    expect(result.current.fetchStatus).toBe('idle');
    expect(fetch).not.toHaveBeenCalled();
  });
});
