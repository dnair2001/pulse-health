import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import type { Appointment, Slot } from '../../../api/types';
import { errorResponse, jsonResponse, renderWithProviders } from '../../../test/helpers';
import { AppointmentReschedulePage } from './AppointmentReschedulePage';

const SLOTS: Slot[] = [
  {
    id: 'slt_010',
    providerId: 'prv_001',
    startsAt: '2099-01-06T11:00:00Z',
    endsAt: '2099-01-06T11:30:00Z',
    isBooked: false,
  },
  {
    id: 'slt_011',
    providerId: 'prv_001',
    startsAt: '2099-01-06T12:00:00Z',
    endsAt: '2099-01-06T12:30:00Z',
    isBooked: false,
  },
];

function buildAppointment(overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: 'apt_001',
    providerId: 'prv_001',
    provider: {
      id: 'prv_001',
      name: 'Dr Amara Okafor',
      specialty: 'Cardiology',
      locationName: 'Riverside Clinic',
    },
    slotId: 'slt_001',
    startsAt: '2099-01-05T09:00:00Z',
    endsAt: '2099-01-05T09:30:00Z',
    status: 'scheduled',
    visitType: 'video',
    reason: 'Annual physical',
    cancellable: true,
    createdAt: '2098-12-01T10:00:00Z',
    updatedAt: '2098-12-01T10:00:00Z',
    ...overrides,
  };
}

type Handler = (url: string, init?: RequestInit) => Response | Promise<Response>;

function install(handler: Handler): void {
  globalThis.fetchMock.mockImplementation((url: string, init?: RequestInit) =>
    Promise.resolve(handler(url, init)),
  );
}

/** Serves the appointment and its slots; `patch` answers the reschedule call. */
function installApi(
  appointment: Appointment,
  patch: Handler = () => jsonResponse(appointment),
): void {
  install((url, init) => {
    if (url.startsWith('/api/slots')) {
      return jsonResponse(SLOTS);
    }
    if (init?.method === 'PATCH') {
      return patch(url, init);
    }
    return jsonResponse(appointment);
  });
}

function requestedUrls(): string[] {
  return globalThis.fetchMock.mock.calls.map((call) => String((call as unknown[])[0]));
}

function slotUrls(): string[] {
  return requestedUrls().filter((url) => url.startsWith('/api/slots'));
}

function patchCalls(): Array<{ url: string; body: unknown }> {
  return globalThis.fetchMock.mock.calls
    .map((call) => call as unknown[])
    .filter((call) => (call[1] as RequestInit | undefined)?.method === 'PATCH')
    .map((call) => ({
      url: String(call[0]),
      body: JSON.parse(String((call[1] as RequestInit).body)) as unknown,
    }));
}

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/appointments/:id/reschedule" element={<AppointmentReschedulePage />} />
      <Route path="/appointments" element={<div>list stub</div>} />
    </Routes>,
    { route: '/appointments/apt_001/reschedule' },
  );
}

describe('AppointmentReschedulePage', () => {
  it('shows a spinner while the appointment loads', () => {
    installApi(buildAppointment());

    renderPage();

    expect(screen.getByTestId('loading-spinner')).toHaveTextContent('Loading appointment…');
    expect(screen.queryByTestId('current-appointment')).not.toBeInTheDocument();
  });

  it('fetches the appointment named in the route', async () => {
    installApi(buildAppointment());

    renderPage();
    await screen.findByTestId('current-appointment');

    expect(requestedUrls()).toContain('/api/appointments/apt_001');
  });

  it('renders the current appointment with formatted time, provider and visit type label', async () => {
    installApi(buildAppointment());

    renderPage();

    const card = await screen.findByTestId('current-appointment');
    expect(card).toHaveTextContent('Mon 5 Jan 2099, 09:00 with Dr Amara Okafor (Video visit)');
  });

  it('renders the status badge for the current appointment', async () => {
    installApi(buildAppointment());

    renderPage();
    await screen.findByTestId('current-appointment');

    const badge = screen.getByText('Scheduled');
    expect(badge).toHaveClass('badge--scheduled');
  });

  it('loads the slots for the appointment provider', async () => {
    installApi(buildAppointment());

    renderPage();

    expect(await screen.findByTestId('slot-slt_010')).toHaveTextContent('11:00');
    expect(slotUrls()).toEqual(['/api/slots?providerId=prv_001']);
    expect(screen.getByTestId('slot-slt_011')).toHaveTextContent('12:00');
  });

  it('blocks rescheduling a completed appointment', async () => {
    installApi(buildAppointment({ status: 'completed', cancellable: false }));

    renderPage();
    await screen.findByTestId('current-appointment');

    expect(screen.getByTestId('alert-banner')).toHaveTextContent(
      'Only scheduled appointments can be rescheduled.',
    );
    expect(screen.queryByTestId('submit-reschedule')).not.toBeInTheDocument();
    expect(screen.queryByTestId('slot-picker')).not.toBeInTheDocument();
  });

  it('blocks rescheduling a cancelled appointment', async () => {
    installApi(buildAppointment({ status: 'cancelled', cancellable: false }));

    renderPage();
    await screen.findByTestId('current-appointment');

    expect(screen.getByTestId('alert-banner')).toHaveTextContent(
      'Only scheduled appointments can be rescheduled.',
    );
    expect(screen.queryByTestId('submit-reschedule')).not.toBeInTheDocument();
  });

  it('requires a new slot before submitting', async () => {
    installApi(buildAppointment());

    renderPage();
    await screen.findByTestId('submit-reschedule');

    await userEvent.click(screen.getByTestId('submit-reschedule'));

    expect(await screen.findByTestId('slot-error')).toHaveTextContent(
      'Please choose a new time slot.',
    );
    expect(patchCalls()).toEqual([]);
  });

  it('patches the appointment with the new slot and navigates to the list', async () => {
    installApi(buildAppointment());

    renderPage();
    await screen.findByTestId('slot-slt_010');

    await userEvent.click(screen.getByTestId('slot-slt_011'));
    await userEvent.click(screen.getByTestId('submit-reschedule'));

    expect(await screen.findByText('list stub')).toBeInTheDocument();
    expect(patchCalls()).toEqual([
      { url: '/api/appointments/apt_001', body: { slotId: 'slt_011' } },
    ]);
  });

  it('clears the slot error once a slot is picked', async () => {
    installApi(buildAppointment());

    renderPage();
    await screen.findByTestId('slot-slt_010');
    await userEvent.click(screen.getByTestId('submit-reschedule'));
    await screen.findByTestId('slot-error');

    await userEvent.click(screen.getByTestId('slot-slt_010'));

    await waitFor(() => expect(screen.queryByTestId('slot-error')).not.toBeInTheDocument());
  });

  it('shows the error banner and clears the selection when the slot is taken', async () => {
    installApi(buildAppointment(), () =>
      errorResponse(409, 'SLOT_ALREADY_BOOKED', 'That slot was just taken.', 'slotId'),
    );

    renderPage();
    await screen.findByTestId('slot-slt_010');
    await userEvent.click(screen.getByTestId('slot-slt_010'));
    expect(screen.getByTestId('slot-slt_010')).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(screen.getByTestId('submit-reschedule'));

    expect(await screen.findByTestId('alert-banner')).toHaveTextContent(
      'That slot was just taken.',
    );
    expect(screen.getByTestId('slot-slt_010')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByText('list stub')).not.toBeInTheDocument();
  });

  it('keeps the slot field error after the availability refetch settles', async () => {
    installApi(buildAppointment(), () =>
      errorResponse(409, 'SLOT_ALREADY_BOOKED', 'That slot was just taken.', 'slotId'),
    );

    renderPage();
    await screen.findByTestId('slot-slt_010');
    await userEvent.click(screen.getByTestId('slot-slt_010'));
    await userEvent.click(screen.getByTestId('submit-reschedule'));
    await screen.findByTestId('slot-error');

    await waitFor(() => expect(slotUrls()).toHaveLength(2));
    await waitFor(() => expect(screen.getByTestId('slot-slt_010')).toBeEnabled());

    expect(screen.getByTestId('slot-error')).toHaveTextContent('That slot was just taken.');
  });

  it('shows the banner but keeps the selection for a non-slot failure', async () => {
    installApi(buildAppointment(), () =>
      errorResponse(
        409,
        'APPOINTMENT_NOT_RESCHEDULABLE',
        'This appointment can no longer be moved.',
      ),
    );

    renderPage();
    await screen.findByTestId('slot-slt_010');
    await userEvent.click(screen.getByTestId('slot-slt_010'));

    await userEvent.click(screen.getByTestId('submit-reschedule'));

    expect(await screen.findByTestId('alert-banner')).toHaveTextContent(
      'This appointment can no longer be moved.',
    );
    expect(screen.getByTestId('slot-slt_010')).toHaveAttribute('aria-pressed', 'true');
    expect(slotUrls()).toHaveLength(1);
  });

  it('shows the load error and no form when the appointment is missing', async () => {
    install((url) => {
      if (url.startsWith('/api/slots')) {
        return jsonResponse(SLOTS);
      }
      return errorResponse(404, 'NOT_FOUND', 'We could not find that appointment.');
    });

    renderPage();

    expect(await screen.findByTestId('alert-banner')).toHaveTextContent(
      'We could not find that appointment.',
    );
    expect(screen.queryByTestId('current-appointment')).not.toBeInTheDocument();
    expect(screen.queryByTestId('submit-reschedule')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Dismiss' })).not.toBeInTheDocument();
  });

  it('requests no slots when the appointment never loads', async () => {
    install((url) => {
      if (url.startsWith('/api/slots')) {
        return jsonResponse(SLOTS);
      }
      return errorResponse(404, 'NOT_FOUND', 'We could not find that appointment.');
    });

    renderPage();
    await screen.findByTestId('alert-banner');

    expect(slotUrls()).toEqual([]);
  });

  it('shows Rescheduling… while the patch is in flight', async () => {
    let releasePatch: (value: Response) => void = () => undefined;
    installApi(
      buildAppointment(),
      () =>
        new Promise<Response>((resolve) => {
          releasePatch = resolve;
        }),
    );

    renderPage();
    await screen.findByTestId('slot-slt_010');
    await userEvent.click(screen.getByTestId('slot-slt_010'));

    await userEvent.click(screen.getByTestId('submit-reschedule'));

    await waitFor(() =>
      expect(screen.getByTestId('submit-reschedule')).toHaveTextContent('Rescheduling…'),
    );
    expect(screen.getByTestId('submit-reschedule')).toBeDisabled();

    releasePatch(jsonResponse(buildAppointment()));
    expect(await screen.findByText('list stub')).toBeInTheDocument();
  });

  it('navigates back to the list from the Back button', async () => {
    installApi(buildAppointment());

    renderPage();
    await screen.findByTestId('submit-reschedule');

    await userEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(await screen.findByText('list stub')).toBeInTheDocument();
  });
});
