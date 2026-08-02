import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import type { Appointment, Provider, Slot, VisitType } from '../../../api/types';
import { errorResponse, jsonResponse, renderWithProviders } from '../../../test/helpers';
import { AppointmentSchedulePage } from './AppointmentSchedulePage';

const PROVIDERS: Provider[] = [
  {
    id: 'prv_001',
    name: 'Dr Amara Okafor',
    specialty: 'Cardiology',
    locationName: 'Riverside Clinic',
    credentials: 'MD',
  },
  {
    id: 'prv_002',
    name: 'Dr Ravi Menon',
    specialty: 'Dermatology',
    locationName: 'Hilltop Surgery',
    credentials: 'MD',
  },
];

const VISIT_TYPES: VisitType[] = [
  { id: 'in_person', label: 'In person', durationMinutes: 30 },
  { id: 'video', label: 'Video visit', durationMinutes: 20 },
];

const SLOTS: Slot[] = [
  {
    id: 'slt_001',
    providerId: 'prv_001',
    startsAt: '2099-01-05T09:00:00Z',
    endsAt: '2099-01-05T09:30:00Z',
    isBooked: false,
  },
  {
    id: 'slt_002',
    providerId: 'prv_001',
    startsAt: '2099-01-05T10:00:00Z',
    endsAt: '2099-01-05T10:30:00Z',
    isBooked: false,
  },
];

const CREATED: Appointment = {
  id: 'apt_100',
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
};

type Handler = (url: string, init?: RequestInit) => Response | Promise<Response>;

function install(handler: Handler): void {
  globalThis.fetchMock.mockImplementation((url: string, init?: RequestInit) =>
    Promise.resolve(handler(url, init)),
  );
}

/** Serves the reference data, the slot list and whatever the POST handler returns. */
function installApi(post: Handler = () => jsonResponse(CREATED)): void {
  install((url, init) => {
    if (url.startsWith('/api/providers')) {
      return jsonResponse(PROVIDERS);
    }
    if (url.startsWith('/api/visit-types')) {
      return jsonResponse(VISIT_TYPES);
    }
    if (url.startsWith('/api/slots')) {
      return jsonResponse(SLOTS);
    }
    return post(url, init);
  });
}

function requestedUrls(): string[] {
  return globalThis.fetchMock.mock.calls.map((call) => String((call as unknown[])[0]));
}

function slotUrls(): string[] {
  return requestedUrls().filter((url) => url.startsWith('/api/slots'));
}

function postBodies(): unknown[] {
  return globalThis.fetchMock.mock.calls
    .map((call) => call as unknown[])
    .filter((call) => String(call[0]) === '/api/appointments')
    .map((call) => JSON.parse(String((call[1] as RequestInit).body)) as unknown);
}

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/appointments/schedule" element={<AppointmentSchedulePage />} />
      <Route path="/appointments" element={<div>list stub</div>} />
    </Routes>,
    { route: '/appointments/schedule' },
  );
}

async function chooseProvider(providerId = 'prv_001'): Promise<void> {
  await userEvent.selectOptions(screen.getByTestId('provider-select'), providerId);
  await screen.findByTestId('slot-slt_001');
}

async function fillValidForm(): Promise<void> {
  await chooseProvider();
  await userEvent.click(screen.getByTestId('slot-slt_001'));
  await userEvent.selectOptions(screen.getByTestId('visit-type-select'), 'in_person');
  await userEvent.type(screen.getByTestId('reason-input'), 'Annual physical');
}

describe('AppointmentSchedulePage', () => {
  it('shows a providers spinner instead of the form while providers load', () => {
    installApi();

    renderPage();

    expect(screen.getByTestId('loading-spinner')).toHaveTextContent('Loading providers…');
    expect(screen.queryByTestId('provider-select')).not.toBeInTheDocument();
  });

  it('renders the form with provider options once providers resolve', async () => {
    installApi();

    renderPage();

    const select = await screen.findByTestId('provider-select');
    expect(select).toHaveTextContent('Choose a provider');
    expect(select).toHaveTextContent('Dr Amara Okafor · Cardiology');
    expect(select).toHaveTextContent('Dr Ravi Menon · Dermatology');
    expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
  });

  it('renders the visit type options from the API', async () => {
    installApi();

    renderPage();

    const select = await screen.findByTestId('visit-type-select');
    expect(select).toHaveTextContent('In person (30 min)');
    expect(select).toHaveTextContent('Video visit (20 min)');
  });

  it('shows the reference error banner when providers fail to load', async () => {
    install((url) => {
      if (url.startsWith('/api/providers')) {
        return errorResponse(500, 'BOOM', 'Providers are unavailable right now.');
      }
      return jsonResponse(VISIT_TYPES);
    });

    renderPage();

    expect(await screen.findByTestId('alert-banner')).toHaveTextContent(
      'Providers are unavailable right now.',
    );
  });

  it('requests no slots until a provider is chosen', async () => {
    installApi();

    renderPage();
    await screen.findByTestId('provider-select');

    expect(slotUrls()).toEqual([]);
    expect(screen.getByTestId('slot-picker-empty')).toBeInTheDocument();
  });

  it('requests and renders slots for the chosen provider', async () => {
    installApi();

    renderPage();
    await screen.findByTestId('provider-select');

    await chooseProvider();

    expect(slotUrls()).toEqual(['/api/slots?providerId=prv_001']);
    expect(screen.getByTestId('slot-slt_001')).toHaveTextContent('09:00');
    expect(screen.getByTestId('slot-slt_002')).toHaveTextContent('10:00');
  });

  it('refetches slots for a different provider', async () => {
    installApi();

    renderPage();
    await screen.findByTestId('provider-select');
    await chooseProvider();

    await userEvent.selectOptions(screen.getByTestId('provider-select'), 'prv_002');

    await waitFor(() => expect(slotUrls()).toContain('/api/slots?providerId=prv_002'));
  });

  it('reports every missing field when an empty form is submitted', async () => {
    installApi();

    renderPage();
    await screen.findByTestId('submit-appointment');

    await userEvent.click(screen.getByTestId('submit-appointment'));

    expect(await screen.findByText('Please choose a provider.')).toBeInTheDocument();
    expect(screen.getByText('Please choose a time slot.')).toBeInTheDocument();
    expect(screen.getByText('Please choose a visit type.')).toBeInTheDocument();
    expect(screen.getByTestId('reason-error')).toHaveTextContent(
      'A reason for the visit is required.',
    );
    expect(postBodies()).toEqual([]);
  });

  it('rejects a whitespace-only reason without calling the API', async () => {
    installApi();

    renderPage();
    await screen.findByTestId('provider-select');
    await chooseProvider();
    await userEvent.click(screen.getByTestId('slot-slt_001'));
    await userEvent.selectOptions(screen.getByTestId('visit-type-select'), 'in_person');
    await userEvent.type(screen.getByTestId('reason-input'), '   ');

    await userEvent.click(screen.getByTestId('submit-appointment'));

    expect(await screen.findByTestId('reason-error')).toHaveTextContent(
      'A reason for the visit is required.',
    );
    expect(postBodies()).toEqual([]);
  });

  it('rejects a reason that is too short', async () => {
    installApi();

    renderPage();
    await screen.findByTestId('provider-select');
    await chooseProvider();
    await userEvent.click(screen.getByTestId('slot-slt_001'));
    await userEvent.selectOptions(screen.getByTestId('visit-type-select'), 'in_person');
    await userEvent.type(screen.getByTestId('reason-input'), 'ab');

    await userEvent.click(screen.getByTestId('submit-appointment'));

    expect(await screen.findByTestId('reason-error')).toHaveTextContent(
      'Please add a little more detail.',
    );
    expect(postBodies()).toEqual([]);
  });

  it('posts the trimmed booking body and navigates to the list on success', async () => {
    installApi();

    renderPage();
    await screen.findByTestId('provider-select');
    await chooseProvider();
    await userEvent.click(screen.getByTestId('slot-slt_001'));
    await userEvent.selectOptions(screen.getByTestId('visit-type-select'), 'video');
    await userEvent.type(screen.getByTestId('reason-input'), '  Annual physical  ');

    await userEvent.click(screen.getByTestId('submit-appointment'));

    expect(await screen.findByText('list stub')).toBeInTheDocument();
    expect(postBodies()).toEqual([
      {
        providerId: 'prv_001',
        slotId: 'slt_001',
        visitType: 'video',
        reason: 'Annual physical',
      },
    ]);
  });

  it('shows Scheduling… while the booking request is in flight', async () => {
    let releasePost: (value: Response) => void = () => undefined;
    installApi(
      () =>
        new Promise<Response>((resolve) => {
          releasePost = resolve;
        }),
    );

    renderPage();
    await screen.findByTestId('provider-select');
    await fillValidForm();

    await userEvent.click(screen.getByTestId('submit-appointment'));

    await waitFor(() =>
      expect(screen.getByTestId('submit-appointment')).toHaveTextContent('Scheduling…'),
    );
    expect(screen.getByTestId('submit-appointment')).toBeDisabled();

    releasePost(jsonResponse(CREATED));
    expect(await screen.findByText('list stub')).toBeInTheDocument();
  });

  it('keeps the slot field error on screen after a SLOT_ALREADY_BOOKED refetch settles', async () => {
    installApi(() =>
      errorResponse(409, 'SLOT_ALREADY_BOOKED', 'That slot was just taken.', 'slotId'),
    );

    renderPage();
    await screen.findByTestId('provider-select');
    await fillValidForm();
    expect(screen.getByTestId('slot-slt_001')).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(screen.getByTestId('submit-appointment'));

    expect(await screen.findByTestId('slot-server-error')).toHaveTextContent(
      'That slot was just taken.',
    );
    expect(screen.getByTestId('alert-banner')).toHaveTextContent('That slot was just taken.');
    expect(screen.getByTestId('slot-slt_001')).toHaveAttribute('aria-pressed', 'false');

    await waitFor(() => expect(slotUrls()).toHaveLength(2));
    await waitFor(() => expect(screen.getByTestId('slot-slt_001')).toBeEnabled());

    expect(screen.getByTestId('slot-server-error')).toHaveTextContent('That slot was just taken.');
    expect(screen.getByTestId('alert-banner')).toHaveTextContent('That slot was just taken.');
    expect(screen.queryByText('list stub')).not.toBeInTheDocument();
  });

  it('keeps the slot field error on screen after a SLOT_IN_PAST refetch settles', async () => {
    installApi(() =>
      errorResponse(422, 'SLOT_IN_PAST', 'That time has already passed.', 'slotId'),
    );

    renderPage();
    await screen.findByTestId('provider-select');
    await fillValidForm();

    await userEvent.click(screen.getByTestId('submit-appointment'));

    expect(await screen.findByTestId('slot-server-error')).toHaveTextContent(
      'That time has already passed.',
    );
    expect(screen.getByTestId('slot-slt_001')).toHaveAttribute('aria-pressed', 'false');

    await waitFor(() => expect(slotUrls()).toHaveLength(2));
    await waitFor(() => expect(screen.getByTestId('slot-slt_001')).toBeEnabled());

    expect(screen.getByTestId('slot-server-error')).toHaveTextContent(
      'That time has already passed.',
    );
    expect(screen.getByTestId('alert-banner')).toHaveTextContent('That time has already passed.');
  });

  it('lets the user recover by picking another slot after a rejected booking', async () => {
    let firstAttempt = true;
    installApi(() => {
      if (firstAttempt) {
        firstAttempt = false;
        return errorResponse(409, 'SLOT_ALREADY_BOOKED', 'That slot was just taken.', 'slotId');
      }
      return jsonResponse(CREATED);
    });

    renderPage();
    await screen.findByTestId('provider-select');
    await fillValidForm();
    await userEvent.click(screen.getByTestId('submit-appointment'));
    await screen.findByTestId('slot-server-error');
    await waitFor(() => expect(slotUrls()).toHaveLength(2));

    await userEvent.click(screen.getByTestId('slot-slt_002'));
    await userEvent.click(screen.getByTestId('submit-appointment'));

    expect(await screen.findByText('list stub')).toBeInTheDocument();
    expect(postBodies()).toHaveLength(2);
    expect(postBodies()[1]).toEqual({
      providerId: 'prv_001',
      slotId: 'slt_002',
      visitType: 'in_person',
      reason: 'Annual physical',
    });
  });

  it('clears the server banner when the provider is changed after a failure', async () => {
    installApi(() =>
      errorResponse(409, 'SLOT_ALREADY_BOOKED', 'That slot was just taken.', 'slotId'),
    );

    renderPage();
    await screen.findByTestId('provider-select');
    await fillValidForm();
    await userEvent.click(screen.getByTestId('submit-appointment'));
    await screen.findByTestId('alert-banner');

    await userEvent.selectOptions(screen.getByTestId('provider-select'), 'prv_002');

    await waitFor(() => expect(screen.queryByTestId('alert-banner')).not.toBeInTheDocument());
  });

  it('dismisses the server banner from its close button', async () => {
    installApi(() =>
      errorResponse(409, 'SLOT_ALREADY_BOOKED', 'That slot was just taken.', 'slotId'),
    );

    renderPage();
    await screen.findByTestId('provider-select');
    await fillValidForm();
    await userEvent.click(screen.getByTestId('submit-appointment'));
    await screen.findByTestId('alert-banner');

    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

    expect(screen.queryByTestId('alert-banner')).not.toBeInTheDocument();
  });

  it('lands a VALIDATION_ERROR for the reason field on the reason input', async () => {
    installApi(() =>
      errorResponse(422, 'VALIDATION_ERROR', 'Please describe your symptoms.', 'reason'),
    );

    renderPage();
    await screen.findByTestId('provider-select');
    await fillValidForm();

    await userEvent.click(screen.getByTestId('submit-appointment'));

    expect(await screen.findByTestId('reason-error')).toHaveTextContent(
      'Please describe your symptoms.',
    );
    expect(screen.getByTestId('alert-banner')).toHaveTextContent('Please describe your symptoms.');
    expect(screen.getByTestId('slot-slt_001')).toHaveAttribute('aria-pressed', 'true');
    expect(slotUrls()).toHaveLength(1);
  });

  it('shows only the banner for a server error with no field', async () => {
    installApi(() => errorResponse(500, 'BOOM', 'Booking is temporarily unavailable.'));

    renderPage();
    await screen.findByTestId('provider-select');
    await fillValidForm();

    await userEvent.click(screen.getByTestId('submit-appointment'));

    expect(await screen.findByTestId('alert-banner')).toHaveTextContent(
      'Booking is temporarily unavailable.',
    );
    expect(screen.queryByTestId('slot-server-error')).not.toBeInTheDocument();
    expect(screen.queryByTestId('reason-error')).not.toBeInTheDocument();
    expect(screen.queryByText('list stub')).not.toBeInTheDocument();
  });

  it('navigates back to the list from the Back button', async () => {
    installApi();

    renderPage();
    await screen.findByTestId('provider-select');

    await userEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(await screen.findByText('list stub')).toBeInTheDocument();
  });
});
