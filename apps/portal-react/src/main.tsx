import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';

import { App } from './App';
import { shouldRetryQuery } from './api/client';
import { NotificationProvider } from './notifications/NotificationProvider';
import './styles/global.scss';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: shouldRetryQuery, refetchOnWindowFocus: false },
    // Mutations stay non-retrying. Unlike GETs, the write endpoints here are not
    // idempotent under retry: POST /api/appointments (scheduling) has no idempotency-key
    // mechanism on the frozen contract, so a client-side retry after a timeout could
    // double-submit a booking that the server would only sometimes catch (only if the
    // same slot is still free would SLOT_ALREADY_BOOKED reject the second attempt; if a
    // third party freed and re-took the slot in between, both requests could succeed).
    // Cancel-appointment is closer to safe to retry (a duplicate cancel just gets
    // APPOINTMENT_NOT_CANCELLABLE back), but that is a per-call decision for the mutation
    // that calls it, not a global default here, so it is left off globally.
    mutations: { retry: false },
  },
});

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <NotificationProvider>
          <App />
        </NotificationProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
