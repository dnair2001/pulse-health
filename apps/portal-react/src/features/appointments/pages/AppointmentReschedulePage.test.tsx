import { describe, expect, it } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { Appointment, Slot } from '../../../api/types';
import { formatFullDateTime } from '../../../shared/formatDateTime';
import { errorResponse, jsonResponse, renderWithProviders } from '../../../test/helpers';
import { AppointmentReschedulePage } from './AppointmentReschedulePage';

const APPOINTMENT: Appointment = {
  id: 'apt_001',
  providerId: 'prv_001',
  provider: {
    id: 'prv_001',
    name: 'Dr. Alice Nguyen',
    specialty: 'Primary Care',
    locationName: 'Pulse Health Downtown',
  },
  slotId: 'slt_prv_001_20260803T0900',
  startsAt: '2026-08-03T09:00:00Z',
  endsAt: '2026-08-03T09:30:00Z',
  status: 'scheduled',
  visitType: 'in_person',
  reason: 'Annual physical',
  cancellable: true,
  createdAt: '2026-08-01T12:00:00Z',
  updatedAt: '2026-08-01T12:00:00Z',
};

const SLOT_ONE: Slot = {
  id: 'slt_prv_001_20260804T0900',
  providerId: 'prv_001',
  startsAt: '2026-08-04T09:00:00Z',
  endsAt: '2026-08-04T09:30:00Z',
  isBooked: false,
};

const SLOT_TWO: Slot = {
  id: 'slt_prv_001_20260804T0930',
  providerId: 'prv_001',
  startsAt: '2026-08-04T09:30:00Z',
  endsAt: '2026-08-04T10:00:00Z',
  isBooked: false,
};

interface Handlers {
  appointment?: () => Response | Promise<Response>;
  slots?: (callIndex: number) => Response | Promise<Response>;
  reschedule?: () => Response | Promise<Response>;
}

function mockApi(handlers: Handlers = {}): void {
  let slotCallIndex = 0;

  globalThis.fetchMock.mockImplementation((input: unknown, init?: RequestInit) => {
    const url = String(input);

    if (url.startsWith('/api/slots')) {
      const index = slotCallIndex;
      slotCallIndex += 1;
      return Promise.resolve(
        handlers.slots ? handlers.slots(index) : jsonResponse([SLOT_ONE, SLOT_TWO]),
      );
    }
    if (url.startsWith('/api/appointments/') && init?.method === 'PATCH') {
      return Promise.resolve(
        handlers.reschedule ? handlers.reschedule() : jsonResponse(APPOINTMENT),
      );
    }
    if (url.startsWith('/api/appointments/')) {
      return Promise.resolve(
        handlers.appointment ? handlers.appointment() : jsonResponse(APPOINTMENT),
      );
    }

    return Promise.resolve(errorResponse(404, 'NOT_FOUND', 'Unexpected request.', null));
  });
}

function calls(): Array<[string, RequestInit | undefined]> {
  const recorded = globalThis.fetchMock.mock.calls as Array<[unknown, RequestInit | undefined]>;
  return recorded.map(([input, init]) => [String(input), init]);
}

function slotRequests(): Array<[string, RequestInit | undefined]> {
  return calls().filter(([url]) => url.startsWith('/api/slots'));
}

function patchRequests(): Array<[string, RequestInit | undefined]> {
  return calls().filter(([, init]) => init?.method === 'PATCH');
}

function renderPage(route = '/appointments/apt_001/reschedule') {
  return renderWithProviders(
    <Routes>
      <Route path="/appointments/:id/reschedule" element={<AppointmentReschedulePage />} />
      <Route path="/appointments/reschedule" element={<AppointmentReschedulePage />} />
    </Routes>,
    { route },
  );
}

describe('AppointmentReschedulePage', () => {
  it('shows the current appointment and patches the chosen slot', async () => {
    const user = userEvent.setup();
    mockApi();
    renderPage();

    const card = await screen.findByTestId('current-appointment');
    expect(card).toHaveTextContent(
      `${formatFullDateTime(APPOINTMENT.startsAt)} with Dr. Alice Nguyen (In person)`,
    );

    await user.click(await screen.findByTestId(`slot-${SLOT_TWO.id}`));
    await user.click(screen.getByTestId('submit-reschedule'));

    await waitFor(() => expect(patchRequests()).toHaveLength(1));
    const [url, init] = patchRequests()[0];
    expect(url).toBe('/api/appointments/apt_001');
    expect(JSON.parse(String(init?.body))).toEqual({ slotId: SLOT_TWO.id });
  });

  it('reports an unknown appointment and never requests one without a route param', async () => {
    mockApi({
      appointment: () =>
        errorResponse(404, 'NOT_FOUND', 'We could not find that appointment.', 'id'),
    });
    const { unmount } = renderPage('/appointments/apt_missing/reschedule');

    expect(await screen.findByTestId('alert-banner')).toHaveTextContent(
      'We could not find that appointment.',
    );
    expect(screen.queryByTestId('submit-reschedule')).not.toBeInTheDocument();

    unmount();
    globalThis.fetchMock.mockClear();
    renderPage('/appointments/reschedule');

    expect(await screen.findByTestId('alert-banner')).toHaveTextContent(
      'We could not find that appointment.',
    );
    expect(screen.queryByTestId('submit-reschedule')).not.toBeInTheDocument();
    expect(calls()).toHaveLength(0);
  });

  it('refuses to reschedule an appointment that is not scheduled', async () => {
    mockApi({ appointment: () => jsonResponse({ ...APPOINTMENT, status: 'cancelled' }) });
    renderPage();

    expect(
      await screen.findByText('Only scheduled appointments can be rescheduled.'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('current-appointment')).toBeInTheDocument();
    expect(screen.queryByTestId('submit-reschedule')).not.toBeInTheDocument();
  });

  it('reloads availability and clears the stale slot when the booking is rejected', async () => {
    const user = userEvent.setup();
    mockApi({
      slots: (index) => jsonResponse(index === 0 ? [SLOT_ONE, SLOT_TWO] : [SLOT_ONE]),
      reschedule: () =>
        errorResponse(
          409,
          'SLOT_ALREADY_BOOKED',
          'That time slot has just been taken. Please pick another.',
          'slotId',
        ),
    });
    renderPage();

    await user.click(await screen.findByTestId(`slot-${SLOT_TWO.id}`));
    expect(slotRequests()).toHaveLength(1);

    await user.click(screen.getByTestId('submit-reschedule'));

    expect(await screen.findByTestId('alert-banner')).toHaveTextContent(
      'That time slot has just been taken. Please pick another.',
    );
    await waitFor(() => expect(slotRequests()).toHaveLength(2));
    await waitFor(() =>
      expect(screen.queryByTestId(`slot-${SLOT_TWO.id}`)).not.toBeInTheDocument(),
    );

    expect(screen.getByTestId('alert-banner')).toBeInTheDocument();
    expect(screen.getByTestId(`slot-${SLOT_ONE.id}`)).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('submit-reschedule')).toBeEnabled();
  });

  it('drops the server banner when the resubmit is blocked by validation', async () => {
    const user = userEvent.setup();
    mockApi({
      reschedule: () =>
        errorResponse(
          409,
          'SLOT_ALREADY_BOOKED',
          'That time slot has just been taken. Please pick another.',
          'slotId',
        ),
    });
    renderPage();

    await user.click(await screen.findByTestId(`slot-${SLOT_ONE.id}`));
    await user.click(screen.getByTestId('submit-reschedule'));

    expect(await screen.findByTestId('alert-banner')).toBeInTheDocument();

    await user.click(screen.getByTestId('submit-reschedule'));

    expect(await screen.findByText('Please choose a new time slot.')).toBeInTheDocument();
    expect(screen.queryByTestId('alert-banner')).not.toBeInTheDocument();
    expect(patchRequests()).toHaveLength(1);
  });
});
