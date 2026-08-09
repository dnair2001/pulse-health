import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactElement, ReactNode } from 'react';

import type { Provider } from '../api/types';

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
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
      <MemoryRouter initialEntries={[options.route ?? '/']}>{children}</MemoryRouter>
    </QueryClientProvider>
  );

  return render(ui, { wrapper });
}

/** The slice of Response the api client actually reads: `ok`, `status` and `text()`. */
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

export function provider(overrides: Partial<Provider> = {}): Provider {
  return {
    id: 'prv_001',
    name: 'Dr. Alice Nguyen',
    specialty: 'Primary Care',
    credentials: 'MD',
    locationName: 'Pulse Health Downtown',
    bio: 'Dr. Nguyen has practiced primary care for over a decade.',
    ...overrides,
  };
}
