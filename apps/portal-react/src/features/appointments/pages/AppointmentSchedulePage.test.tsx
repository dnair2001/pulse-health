import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { Appointment, Provider, Slot, VisitType } from '../../../api/types';
import { errorResponse, jsonResponse, renderWithProviders } from '../../../test/helpers';
import { AppointmentSchedulePage } from './AppointmentSchedulePage';

const PROVIDERS: Provider[] = [
  {
    id: 'prv_001',
    name: 'Dr. Alice Nguyen',
    specialty: 'Primary Care',
    credentials: 'MD',
    locationName: 'Pulse Health Downtown',
  },
  {
    id: 'prv_002',
    name: 'Dr. Marcus Bell',
    specialty: 'Dermatology',
    credentials: 'MD',
    locationName: 'Pulse Health Riverside',
  },
];

const VISIT_TYPES: VisitType[] = [
  { id: 'in_person', label: 'In person', durationMinutes: 30 },
  { id: 'video', label: 'Video visit', durationMinutes: 20 },
];

const SLOT_ONE: Slot = {
  id: 'slt_prv_001_20260803T0900',
  providerId: 'prv_001',
  startsAt: '2026-08-03T09:00:00Z',
  endsAt: '2026-08-03T09:30:00Z',
  isBooked: false,
};

const SLOT_TWO: Slot = {
  id: 'slt_prv_001_20260803T0930',
  providerId: 'prv_001',
  startsAt: '2026-08-03T09:30:00Z',
  endsAt: '2026-08-03T10:00:00Z',
  isBooked: false,
};

const SLOT_OTHER_PROVIDER: Slot = {
  id: 'slt_prv_002_20260804T1100',
  providerId: 'prv_002',
  startsAt: '2026-08-04T11:00:00Z',
  endsAt: '2026-08-04T11:30:00Z',
  isBooked: false,
};

const CREATED: Appointment = {
  id: 'apt_007',
  providerId: 'prv_001',
  provider: {
    id: 'prv_001',
    name: 'Dr. Alice Nguyen',
    specialty: 'Primary Care',
    locationName: 'Pulse Health Downtown',
  },
  slotId: SLOT_ONE.id,
  startsAt: SLOT_ONE.startsAt,
  endsAt: SLOT_ONE.endsAt,
  status: 'scheduled',
  visitType: 'in_person',
  reason: 'Annual physical',
  cancellable: true,
  createdAt: '2026-08-01T12:00:00Z',
  updatedAt: '2026-08-01T12:00:00Z',
};

interface Handlers {
  slots?: (url: string, callIndex: number) => Response | Promise<Response>;
  schedule?: () => Response | Promise<Response>;
}

function mockApi(handlers: Handlers = {}): void {
  let slotCallIndex = 0;

  globalThis.fetchMock.mockImplementation((input: unknown, init?: RequestInit) => {
    const url = String(input);

    if (url.startsWith('/api/providers')) {
      return Promise.resolve(jsonResponse(PROVIDERS));
    }
    if (url.startsWith('/api/visit-types')) {
      return Promise.resolve(jsonResponse(VISIT_TYPES));
    }
    if (url.startsWith('/api/slots')) {
      const index = slotCallIndex;
      slotCallIndex += 1;
      if (handlers.slots) {
        return Promise.resolve(handlers.slots(url, index));
      }
      return Promise.resolve(jsonResponse(url.includes('prv_002') ? [SLOT_OTHER_PROVIDER] : [SLOT_ONE, SLOT_TWO]));
    }
    if (url === '/api/appointments' && init?.method === 'POST') {
      return Promise.resolve(handlers.schedule ? handlers.schedule() : jsonResponse(CREATED, 201));
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

function scheduleRequests(): Array<[string, RequestInit | undefined]> {
  return calls().filter(([url, init]) => url === '/api/appointments' && init?.method === 'POST');
}

async function fillValidForm(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.selectOptions(await screen.findByTestId('provider-select'), 'prv_001');
  await user.click(await screen.findByTestId(`slot-${SLOT_ONE.id}`));
  await user.selectOptions(screen.getByTestId('visit-type-select'), 'in_person');
  await user.type(screen.getByTestId('reason-input'), '  Annual physical  ');
}

describe('AppointmentSchedulePage', () => {
  it('posts the trimmed form values once every field is valid', async () => {
    const user = userEvent.setup();
    mockApi();
    renderWithProviders(<AppointmentSchedulePage />);

    await fillValidForm(user);
    await user.click(screen.getByTestId('submit-appointment'));

    await waitFor(() => expect(scheduleRequests()).toHaveLength(1));
    const [, init] = scheduleRequests()[0];
    expect(JSON.parse(String(init?.body))).toEqual({
      providerId: 'prv_001',
      slotId: SLOT_ONE.id,
      visitType: 'in_person',
      reason: 'Annual physical',
    });
  });

  it('blocks an empty submit and reports every required field', async () => {
    const user = userEvent.setup();
    mockApi();
    renderWithProviders(<AppointmentSchedulePage />);

    await user.click(await screen.findByTestId('submit-appointment'));

    expect(await screen.findByText('Please choose a provider.')).toBeInTheDocument();
    expect(screen.getByTestId('slot-error')).toHaveTextContent('Please choose a time slot.');
    expect(screen.getByText('Please choose a visit type.')).toBeInTheDocument();
    expect(screen.getByTestId('reason-error')).toHaveTextContent(
      'A reason for the visit is required.',
    );
    expect(scheduleRequests()).toHaveLength(0);
  });

  it('clears the server banner before a resubmit that fails validation', async () => {
    const user = userEvent.setup();
    mockApi({
      schedule: () =>
        errorResponse(422, 'VALIDATION_ERROR', 'Tell us a little more about the visit.', 'reason'),
    });
    renderWithProviders(<AppointmentSchedulePage />);

    await fillValidForm(user);
    await user.click(screen.getByTestId('submit-appointment'));

    expect(await screen.findByTestId('alert-banner')).toHaveTextContent(
      'Tell us a little more about the visit.',
    );

    await user.clear(screen.getByTestId('reason-input'));
    await user.click(screen.getByTestId('submit-appointment'));

    expect(await screen.findByTestId('reason-error')).toHaveTextContent(
      'A reason for the visit is required.',
    );
    expect(screen.queryByTestId('alert-banner')).not.toBeInTheDocument();
    expect(scheduleRequests()).toHaveLength(1);
  });

  it('refreshes availability after a rejected booking without losing either error', async () => {
    const user = userEvent.setup();
    mockApi({
      slots: (_url, index) => jsonResponse(index === 0 ? [SLOT_ONE, SLOT_TWO] : [SLOT_TWO]),
      schedule: () =>
        errorResponse(
          409,
          'SLOT_ALREADY_BOOKED',
          'That time slot has just been taken. Please pick another.',
          'slotId',
        ),
    });
    renderWithProviders(<AppointmentSchedulePage />);

    await fillValidForm(user);
    expect(slotRequests()).toHaveLength(1);

    await user.click(screen.getByTestId('submit-appointment'));

    expect(await screen.findByTestId('slot-server-error')).toHaveTextContent(
      'That time slot has just been taken. Please pick another.',
    );
    await waitFor(() => expect(slotRequests()).toHaveLength(2));
    await waitFor(() =>
      expect(screen.queryByTestId(`slot-${SLOT_ONE.id}`)).not.toBeInTheDocument(),
    );

    expect(screen.getByTestId('alert-banner')).toHaveTextContent(
      'That time slot has just been taken. Please pick another.',
    );
    expect(screen.getByTestId('slot-server-error')).toBeInTheDocument();
    expect(screen.getByTestId(`slot-${SLOT_TWO.id}`)).toHaveAttribute('aria-pressed', 'false');
  });

  it('clears stale validation and server errors when the provider changes', async () => {
    const user = userEvent.setup();
    mockApi({
      schedule: () =>
        errorResponse(
          409,
          'SLOT_ALREADY_BOOKED',
          'That time slot has just been taken. Please pick another.',
          'slotId',
        ),
    });
    renderWithProviders(<AppointmentSchedulePage />);

    await user.click(await screen.findByTestId('submit-appointment'));
    expect(await screen.findByText('Please choose a provider.')).toBeInTheDocument();

    await user.selectOptions(screen.getByTestId('provider-select'), 'prv_001');
    await waitFor(() =>
      expect(screen.queryByText('Please choose a provider.')).not.toBeInTheDocument(),
    );

    await user.click(await screen.findByTestId(`slot-${SLOT_ONE.id}`));
    await user.selectOptions(screen.getByTestId('visit-type-select'), 'in_person');
    await user.type(screen.getByTestId('reason-input'), 'Annual physical');
    await user.click(screen.getByTestId('submit-appointment'));

    expect(await screen.findByTestId('slot-server-error')).toBeInTheDocument();

    await user.selectOptions(screen.getByTestId('provider-select'), 'prv_002');

    await waitFor(() => expect(screen.queryByTestId('slot-server-error')).not.toBeInTheDocument());
    expect(screen.queryByTestId('alert-banner')).not.toBeInTheDocument();
    expect(screen.queryByText('Please choose a provider.')).not.toBeInTheDocument();
    expect(await screen.findByTestId(`slot-${SLOT_OTHER_PROVIDER.id}`)).toBeInTheDocument();
  });

  it('surfaces a failed availability request instead of claiming there are no slots', async () => {
    const user = userEvent.setup();
    mockApi({
      slots: () =>
        errorResponse(500, 'UNKNOWN', 'Availability is temporarily unavailable.', null),
    });
    renderWithProviders(<AppointmentSchedulePage />);

    await user.selectOptions(await screen.findByTestId('provider-select'), 'prv_001');

    expect(await screen.findByTestId('alert-banner')).toHaveTextContent(
      'Availability is temporarily unavailable.',
    );
    expect(screen.queryByTestId('slot-picker-empty')).not.toBeInTheDocument();
    expect(
      screen.queryByText('No open time slots for this provider. Try another provider.'),
    ).not.toBeInTheDocument();
  });

  it('disables the submit button while in flight and re-enables it after a rejection', async () => {
    const user = userEvent.setup();
    let rejectSchedule: ((response: Response) => void) | undefined;
    mockApi({
      schedule: () =>
        new Promise<Response>((resolve) => {
          rejectSchedule = resolve;
        }),
    });
    renderWithProviders(<AppointmentSchedulePage />);

    await fillValidForm(user);
    await user.click(screen.getByTestId('submit-appointment'));

    const submit = await screen.findByTestId('submit-appointment');
    await waitFor(() => expect(submit).toBeDisabled());
    expect(submit).toHaveTextContent('Scheduling…');

    rejectSchedule?.(
      errorResponse(422, 'VALIDATION_ERROR', 'Tell us a little more about the visit.', 'reason'),
    );

    await waitFor(() => expect(screen.getByTestId('submit-appointment')).toBeEnabled());
    expect(screen.getByTestId('submit-appointment')).toHaveTextContent('Confirm appointment');
    expect(within(screen.getByTestId('alert-banner')).getByText(
      'Tell us a little more about the visit.',
    )).toBeInTheDocument();
    expect(screen.getByTestId('reason-input')).toHaveValue('  Annual physical  ');
  });
});
