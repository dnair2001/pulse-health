import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import type { Appointment, VisitType } from '../../../api/types';
import { errorResponse, jsonResponse, renderWithProviders } from '../../../test/helpers';
import { AppointmentListPage } from './AppointmentListPage';

const VISIT_TYPES: VisitType[] = [
  { id: 'in_person', label: 'In person', durationMinutes: 30 },
  { id: 'video', label: 'Video visit', durationMinutes: 20 },
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
    visitType: 'in_person',
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

/** Serves visit types and the given appointment list, and accepts every cancel. */
function installList(list: Appointment[]): void {
  install((url) => {
    if (url.startsWith('/api/visit-types')) {
      return jsonResponse(VISIT_TYPES);
    }
    if (url.includes('/cancel')) {
      return jsonResponse({ ...list[0], status: 'cancelled' });
    }
    return jsonResponse(list);
  });
}

function requestedUrls(): string[] {
  return globalThis.fetchMock.mock.calls.map((call) => String((call as unknown[])[0]));
}

function appointmentUrls(): string[] {
  return requestedUrls().filter((url) => url.startsWith('/api/appointments'));
}

function cancelUrls(): string[] {
  return requestedUrls().filter((url) => url.includes('/cancel'));
}

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/appointments" element={<AppointmentListPage />} />
      <Route path="/appointments/schedule" element={<div>schedule stub</div>} />
      <Route path="/appointments/:id/reschedule" element={<div>reschedule stub</div>} />
    </Routes>,
    { route: '/appointments' },
  );
}

describe('AppointmentListPage', () => {
  it('shows a spinner while the first appointments request is in flight', () => {
    installList([buildAppointment()]);

    renderPage();

    expect(screen.getByTestId('loading-spinner')).toHaveTextContent('Loading your appointments…');
    expect(screen.queryByTestId('appointment-apt_001')).not.toBeInTheDocument();
  });

  it('renders a card per appointment once the request resolves', async () => {
    installList([
      buildAppointment(),
      buildAppointment({ id: 'apt_002', reason: 'Follow-up on labs' }),
    ]);

    renderPage();

    expect(await screen.findByTestId('appointment-apt_001')).toBeInTheDocument();
    expect(screen.getByTestId('appointment-apt_002')).toBeInTheDocument();
    expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
  });

  it('requests the upcoming scope first and marks that tab selected', async () => {
    installList([buildAppointment()]);

    renderPage();

    await screen.findByTestId('appointment-apt_001');
    expect(appointmentUrls()[0]).toBe('/api/appointments?scope=upcoming');
    expect(screen.getByTestId('tab-upcoming')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('tab-past')).toHaveAttribute('aria-selected', 'false');
  });

  it('refetches with scope=past and moves the selected tab when Past is clicked', async () => {
    installList([buildAppointment({ status: 'completed', cancellable: false })]);

    renderPage();
    await screen.findByTestId('appointment-apt_001');

    await userEvent.click(screen.getByTestId('tab-past'));

    await waitFor(() =>
      expect(appointmentUrls()).toContain('/api/appointments?scope=past'),
    );
    expect(screen.getByTestId('tab-past')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('tab-upcoming')).toHaveAttribute('aria-selected', 'false');
  });

  it('refetches with the chosen status filter in the URL', async () => {
    installList([buildAppointment()]);

    renderPage();
    await screen.findByTestId('appointment-apt_001');

    await userEvent.selectOptions(screen.getByTestId('filter-status'), 'completed');

    await waitFor(() =>
      expect(appointmentUrls()).toContain('/api/appointments?scope=upcoming&status=completed'),
    );
  });

  it('refetches with the chosen visit type filter in the URL', async () => {
    installList([buildAppointment()]);

    renderPage();
    await screen.findByTestId('appointment-apt_001');

    await userEvent.selectOptions(screen.getByTestId('filter-visit-type'), 'video');

    await waitFor(() =>
      expect(appointmentUrls()).toContain('/api/appointments?scope=upcoming&visitType=video'),
    );
  });

  it('shows the filtered empty state when active filters match nothing', async () => {
    install((url) => {
      if (url.startsWith('/api/visit-types')) {
        return jsonResponse(VISIT_TYPES);
      }
      return jsonResponse(url.includes('status=') ? [] : [buildAppointment()]);
    });

    renderPage();
    await screen.findByTestId('appointment-apt_001');

    await userEvent.selectOptions(screen.getByTestId('filter-status'), 'completed');

    expect(await screen.findByText('No appointments match these filters')).toBeInTheDocument();
    expect(
      screen.getByText('Clear the filters to see everything in this tab.'),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('empty-state-action')).not.toBeInTheDocument();
  });

  it('shows the upcoming empty state with a schedule action when nothing is booked', async () => {
    installList([]);

    renderPage();

    expect(await screen.findByText('No upcoming appointments')).toBeInTheDocument();
    expect(screen.getByText('Book a visit and it will show up here.')).toBeInTheDocument();
    expect(screen.getByTestId('empty-state-action')).toHaveTextContent('Schedule appointment');
  });

  it('navigates to the schedule route from the upcoming empty state action', async () => {
    installList([]);

    renderPage();
    await screen.findByText('No upcoming appointments');

    await userEvent.click(screen.getByTestId('empty-state-action'));

    expect(await screen.findByText('schedule stub')).toBeInTheDocument();
  });

  it('shows the past empty state with no action', async () => {
    installList([]);

    renderPage();
    await screen.findByText('No upcoming appointments');

    await userEvent.click(screen.getByTestId('tab-past'));

    expect(await screen.findByText('No past appointments')).toBeInTheDocument();
    expect(
      screen.getByText('Completed and cancelled visits will appear here.'),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('empty-state-action')).not.toBeInTheDocument();
  });

  it('renders the error banner and a retry button when the request fails', async () => {
    install((url) => {
      if (url.startsWith('/api/visit-types')) {
        return jsonResponse(VISIT_TYPES);
      }
      return errorResponse(500, 'BOOM', 'Appointments are unavailable right now.');
    });

    renderPage();

    expect(await screen.findByTestId('alert-banner')).toHaveTextContent(
      'Appointments are unavailable right now.',
    );
    expect(screen.getByTestId('retry')).toBeInTheDocument();
    expect(screen.queryByTestId('empty-state')).not.toBeInTheDocument();
  });

  it('refetches and renders the list when retry is clicked', async () => {
    let fail = true;
    install((url) => {
      if (url.startsWith('/api/visit-types')) {
        return jsonResponse(VISIT_TYPES);
      }
      if (fail) {
        fail = false;
        return errorResponse(500, 'BOOM', 'Appointments are unavailable right now.');
      }
      return jsonResponse([buildAppointment()]);
    });

    renderPage();
    await screen.findByTestId('retry');

    await userEvent.click(screen.getByTestId('retry'));

    expect(await screen.findByTestId('appointment-apt_001')).toBeInTheDocument();
    expect(screen.queryByTestId('retry')).not.toBeInTheDocument();
    expect(screen.queryByTestId('alert-banner')).not.toBeInTheDocument();
  });

  it('opens the confirm dialog with the slot details when cancel is clicked', async () => {
    installList([buildAppointment()]);

    renderPage();
    await screen.findByTestId('appointment-apt_001');

    await userEvent.click(screen.getByTestId('cancel-apt_001'));

    const dialog = screen.getByTestId('confirm-dialog');
    expect(dialog).toHaveTextContent('Cancel this appointment?');
    expect(dialog).toHaveTextContent(
      'This will free up your Mon 5 Jan, 09:00 slot with Dr Amara Okafor.',
    );
  });

  it('closes the dialog without calling the API when the cancel is dismissed', async () => {
    installList([buildAppointment()]);

    renderPage();
    await screen.findByTestId('appointment-apt_001');
    await userEvent.click(screen.getByTestId('cancel-apt_001'));

    await userEvent.click(screen.getByTestId('confirm-cancel'));

    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
    expect(cancelUrls()).toEqual([]);
  });

  it('cancels through the API, shows the success banner and refetches', async () => {
    installList([buildAppointment()]);

    renderPage();
    await screen.findByTestId('appointment-apt_001');
    const listCallsBefore = appointmentUrls().length;

    await userEvent.click(screen.getByTestId('cancel-apt_001'));
    await userEvent.click(screen.getByTestId('confirm-accept'));

    await waitFor(() => expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument());
    expect(cancelUrls()).toEqual(['/api/appointments/apt_001/cancel']);
    expect(screen.getByTestId('alert-banner')).toHaveTextContent('Appointment cancelled.');
    expect(screen.getByTestId('alert-banner')).toHaveAttribute('data-variant', 'success');
    await waitFor(() =>
      expect(appointmentUrls().filter((url) => !url.includes('/cancel')).length).toBeGreaterThan(
        listCallsBefore,
      ),
    );
  });

  it('shows the API message and closes the dialog when the cancel is rejected', async () => {
    install((url) => {
      if (url.startsWith('/api/visit-types')) {
        return jsonResponse(VISIT_TYPES);
      }
      if (url.includes('/cancel')) {
        return errorResponse(
          409,
          'APPOINTMENT_NOT_CANCELLABLE',
          'This appointment is too close to its start time to cancel.',
        );
      }
      return jsonResponse([buildAppointment()]);
    });

    renderPage();
    await screen.findByTestId('appointment-apt_001');

    await userEvent.click(screen.getByTestId('cancel-apt_001'));
    await userEvent.click(screen.getByTestId('confirm-accept'));

    const banner = await screen.findByTestId('alert-banner');
    expect(banner).toHaveTextContent('This appointment is too close to its start time to cancel.');
    expect(banner).toHaveAttribute('data-variant', 'error');
    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
  });

  it('dismisses the cancel banner when the close button is clicked', async () => {
    installList([buildAppointment()]);

    renderPage();
    await screen.findByTestId('appointment-apt_001');
    await userEvent.click(screen.getByTestId('cancel-apt_001'));
    await userEvent.click(screen.getByTestId('confirm-accept'));
    await screen.findByTestId('alert-banner');

    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

    expect(screen.queryByTestId('alert-banner')).not.toBeInTheDocument();
  });

  it('blocks cancelling a completed appointment', async () => {
    installList([buildAppointment({ status: 'completed', cancellable: false })]);

    renderPage();
    await screen.findByTestId('appointment-apt_001');

    expect(screen.getByTestId('cancel-blocked')).toHaveTextContent(
      'Completed visits cannot be cancelled.',
    );
    expect(screen.queryByTestId('cancel-apt_001')).not.toBeInTheDocument();
  });

  it('navigates to the schedule route from the header CTA', async () => {
    installList([buildAppointment()]);

    renderPage();
    await screen.findByTestId('appointment-apt_001');

    await userEvent.click(screen.getByTestId('schedule-cta'));

    expect(await screen.findByText('schedule stub')).toBeInTheDocument();
  });

  it('navigates to the reschedule route from a card', async () => {
    installList([buildAppointment()]);

    renderPage();
    await screen.findByTestId('appointment-apt_001');

    await userEvent.click(screen.getByTestId('reschedule-apt_001'));

    expect(await screen.findByText('reschedule stub')).toBeInTheDocument();
  });

  it('populates the visit type filter from the visit types endpoint', async () => {
    installList([buildAppointment()]);

    renderPage();
    await screen.findByTestId('appointment-apt_001');

    const select = screen.getByTestId('filter-visit-type');
    expect(select).toHaveTextContent('In person');
    expect(select).toHaveTextContent('Video visit');
  });
});
