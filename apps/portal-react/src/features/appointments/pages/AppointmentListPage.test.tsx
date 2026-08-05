import { useState } from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import type { Appointment, VisitType } from '../../../api/types';
import { useNotifications } from '../../../notifications/NotificationProvider';
import { formatShortDateTime } from '../../../shared/formatDateTime';
import { errorResponse, jsonResponse, renderWithProviders } from '../../../test/helpers';
import { AppointmentListPage } from './AppointmentListPage';

const VISIT_TYPES: VisitType[] = [
  { id: 'in_person', label: 'In person', durationMinutes: 30 },
  { id: 'video', label: 'Video visit', durationMinutes: 20 },
  { id: 'phone', label: 'Phone call', durationMinutes: 15 },
];

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

type FetchHandler = (url: string, init: RequestInit | undefined) => Response;

function mockFetch(handler: FetchHandler): void {
  globalThis.fetchMock.mockImplementation((url: string, init?: RequestInit) =>
    Promise.resolve(handler(url, init)),
  );
}

/** Serves visit types, then hands every other request to `handler`. */
function mockApi(handler: FetchHandler): void {
  mockFetch((url, init) =>
    url.startsWith('/api/visit-types') ? jsonResponse(VISIT_TYPES) : handler(url, init),
  );
}

function stubList(appointments: Appointment[]): void {
  mockApi(() => jsonResponse(appointments));
}

function requestUrls(): string[] {
  return globalThis.fetchMock.mock.calls.map((call: unknown[]) => String(call[0]));
}

/** Only the list requests, so the cancel POST never inflates the count. */
function listRequests(): string[] {
  return requestUrls().filter((url) => url.startsWith('/api/appointments?'));
}

function cancelRequests(): { url: string; method: string | undefined }[] {
  return globalThis.fetchMock.mock.calls
    .filter((call: unknown[]) => String(call[0]).endsWith('/cancel'))
    .map((call: unknown[]) => ({
      url: String(call[0]),
      method: (call[1] as RequestInit | undefined)?.method,
    }));
}

describe('AppointmentListPage', () => {
  it('requests the upcoming scope on mount and disables the filters while in flight', async () => {
    stubList([APPOINTMENT]);

    renderWithProviders(<AppointmentListPage />);

    expect(screen.getByTestId('filter-status')).toBeDisabled();
    expect(screen.getByTestId('filter-visit-type')).toBeDisabled();

    await screen.findByTestId(`appointment-${APPOINTMENT.id}`);

    expect(listRequests()).toEqual(['/api/appointments?scope=upcoming']);
    expect(screen.getByTestId('filter-status')).toBeEnabled();
    expect(screen.getByTestId('tab-upcoming')).toHaveAttribute('aria-selected', 'true');
  });

  it('re-requests with scope=past when the Past tab is selected', async () => {
    const user = userEvent.setup();
    stubList([]);

    renderWithProviders(<AppointmentListPage />);
    await waitFor(() => expect(listRequests()).toEqual(['/api/appointments?scope=upcoming']));

    await user.click(screen.getByTestId('tab-past'));

    await waitFor(() =>
      expect(listRequests()).toEqual([
        '/api/appointments?scope=upcoming',
        '/api/appointments?scope=past',
      ]),
    );
    expect(screen.getByTestId('tab-past')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('tab-upcoming')).toHaveAttribute('aria-selected', 'false');
  });

  it('narrows the request with the selected status and visit type filters', async () => {
    const user = userEvent.setup();
    stubList([]);

    renderWithProviders(<AppointmentListPage />);
    await waitFor(() => expect(screen.getByTestId('filter-status')).toBeEnabled());

    await user.selectOptions(screen.getByTestId('filter-status'), 'scheduled');
    await waitFor(() => expect(screen.getByTestId('filter-visit-type')).toBeEnabled());
    await user.selectOptions(screen.getByTestId('filter-visit-type'), 'video');

    await waitFor(() =>
      expect(listRequests().at(-1)).toBe(
        '/api/appointments?scope=upcoming&status=scheduled&visitType=video',
      ),
    );
    expect(listRequests()).toContain('/api/appointments?scope=upcoming&status=scheduled');
  });

  it('shows the API message as an error banner, never an empty state, and retries', async () => {
    const user = userEvent.setup();
    mockApi(() => errorResponse(503, 'UNKNOWN', 'The scheduling service is unavailable.'));

    renderWithProviders(<AppointmentListPage />);

    const banner = await screen.findByTestId('alert-banner');
    expect(banner).toHaveTextContent('The scheduling service is unavailable.');
    expect(banner).toHaveAttribute('data-variant', 'error');
    expect(screen.queryByTestId('empty-state')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('retry'));

    await waitFor(() => expect(listRequests()).toHaveLength(2));
    expect(listRequests()).toEqual([
      '/api/appointments?scope=upcoming',
      '/api/appointments?scope=upcoming',
    ]);
  });

  it('offers the schedule action when there are no upcoming appointments', async () => {
    stubList([]);

    renderWithProviders(<AppointmentListPage />);

    const empty = await screen.findByTestId('empty-state');
    expect(screen.getAllByTestId('empty-state')).toHaveLength(1);
    expect(empty).toHaveTextContent('No upcoming appointments');
    expect(empty).toHaveTextContent('When you book a visit it will show up here.');
    expect(screen.getByTestId('empty-state-action')).toHaveTextContent('Schedule appointment');
  });

  it('shows the past empty state without an action on the Past tab', async () => {
    const user = userEvent.setup();
    stubList([]);

    renderWithProviders(<AppointmentListPage />);
    await screen.findByTestId('empty-state');

    await user.click(screen.getByTestId('tab-past'));
    await waitFor(() => expect(listRequests()).toContain('/api/appointments?scope=past'));

    const empty = await screen.findByTestId('empty-state');
    expect(screen.getAllByTestId('empty-state')).toHaveLength(1);
    expect(empty).toHaveTextContent('No past appointments');
    expect(empty).toHaveTextContent('Completed and cancelled visits will appear here.');
    expect(screen.queryByTestId('empty-state-action')).not.toBeInTheDocument();
  });

  it('shows the filtered empty state instead of the scope one when a filter is active', async () => {
    const user = userEvent.setup();
    stubList([]);

    renderWithProviders(<AppointmentListPage />);
    await waitFor(() => expect(screen.getByTestId('filter-visit-type')).toBeEnabled());

    await user.selectOptions(screen.getByTestId('filter-visit-type'), 'phone');
    await waitFor(() =>
      expect(listRequests()).toContain('/api/appointments?scope=upcoming&visitType=phone'),
    );

    const empty = await screen.findByTestId('empty-state');
    expect(screen.getAllByTestId('empty-state')).toHaveLength(1);
    expect(empty).toHaveTextContent('No appointments match these filters');
    expect(empty).toHaveTextContent('Clear the filters to see everything in this list.');
  });

  it('cancels the appointment, reloads the list and confirms with a banner', async () => {
    const user = userEvent.setup();
    let cancelled = false;
    mockApi((url) => {
      if (url.endsWith('/cancel')) {
        cancelled = true;
        return jsonResponse({ ...APPOINTMENT, status: 'cancelled', cancellable: false });
      }
      return jsonResponse(cancelled ? [] : [APPOINTMENT]);
    });

    renderWithProviders(<AppointmentListPage />);

    await user.click(await screen.findByTestId(`cancel-${APPOINTMENT.id}`));

    const dialog = screen.getByTestId('confirm-dialog');
    expect(dialog).toHaveTextContent('Cancel this appointment?');
    expect(dialog).toHaveTextContent(
      `This will free up your ${formatShortDateTime(APPOINTMENT.startsAt)} slot with ${APPOINTMENT.provider.name}.`,
    );

    await user.click(screen.getByTestId('confirm-accept'));

    await waitFor(() =>
      expect(cancelRequests()).toEqual([
        { url: '/api/appointments/apt_001/cancel', method: 'POST' },
      ]),
    );
    expect(await screen.findByText('Appointment cancelled.')).toBeInTheDocument();
    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(listRequests().length).toBeGreaterThan(1));
  });

  it('makes no request when the cancel dialog is dismissed', async () => {
    const user = userEvent.setup();
    stubList([APPOINTMENT]);

    renderWithProviders(<AppointmentListPage />);

    await user.click(await screen.findByTestId(`cancel-${APPOINTMENT.id}`));
    const callsBefore = globalThis.fetchMock.mock.calls.length;

    await user.click(screen.getByTestId('confirm-cancel'));

    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
    expect(globalThis.fetchMock.mock.calls).toHaveLength(callsBefore);
    expect(cancelRequests()).toEqual([]);
    expect(screen.queryByTestId('alert-banner')).not.toBeInTheDocument();
  });

  it('shows a carried-over notification once and not when the page is revisited', async () => {
    const user = userEvent.setup();
    stubList([]);

    function BannerHarness() {
      const { success } = useNotifications();
      const [visible, setVisible] = useState(false);
      return (
        <>
          <button
            type="button"
            data-testid="seed"
            onClick={() => success('Appointment scheduled.')}
          >
            seed
          </button>
          <button type="button" data-testid="toggle" onClick={() => setVisible((open) => !open)}>
            toggle
          </button>
          {visible ? <AppointmentListPage /> : null}
        </>
      );
    }

    renderWithProviders(<BannerHarness />);

    await user.click(screen.getByTestId('seed'));
    await user.click(screen.getByTestId('toggle'));

    expect(await screen.findByText('Appointment scheduled.')).toBeInTheDocument();

    await user.click(screen.getByTestId('toggle'));
    await user.click(screen.getByTestId('toggle'));

    await screen.findByTestId('empty-state');
    expect(screen.queryByTestId('alert-banner')).not.toBeInTheDocument();
  });
});
