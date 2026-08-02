import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactElement, ReactNode } from 'react';

import { NotificationProvider } from '../notifications/NotificationProvider';

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

export function renderWithProviders(
  ui: ReactElement,
  options: { route?: string; queryClient?: QueryClient } = {},
) {
  const queryClient = options.queryClient ?? createTestQueryClient();

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[options.route ?? '/']}>
        <NotificationProvider>{children}</NotificationProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );

  return { ...render(ui, { wrapper }), queryClient };
}

/** Builds the Response shape the api client expects, without touching the network. */
export function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(body === null ? '' : JSON.stringify(body)),
  } as Response;
}

export function errorResponse(
  status: number,
  code: string,
  message: string,
  field: string | null = null,
): Response {
  return jsonResponse({ error: { code, message, field } }, status);
}
