import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { Appointment, AppointmentStatus } from '../../../api/types';
import { renderWithProviders } from '../../../test/helpers';
import { AppointmentCard } from './AppointmentCard';

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

function buildFor(status: AppointmentStatus, cancellable: boolean): Appointment {
  return buildAppointment({ status, cancellable });
}

describe('AppointmentCard', () => {
  it('renders the provider name, specialty and location', () => {
    renderWithProviders(<AppointmentCard appointment={buildAppointment()} />);

    expect(screen.getByRole('heading', { name: 'Dr Amara Okafor' })).toBeInTheDocument();
    expect(screen.getByText('Cardiology · Riverside Clinic')).toBeInTheDocument();
  });

  it('renders the card under an id-scoped test id', () => {
    renderWithProviders(<AppointmentCard appointment={buildAppointment({ id: 'apt_042' })} />);

    expect(screen.getByTestId('appointment-apt_042')).toBeInTheDocument();
  });

  it('formats the date and time range the way the Angular date pipes did', () => {
    renderWithProviders(<AppointmentCard appointment={buildAppointment()} />);

    expect(screen.getByTestId('appointment-when')).toHaveTextContent(
      'Mon 5 Jan 2099, 09:00 – 09:30',
    );
  });

  it('renders the human visit type label rather than the raw id', () => {
    renderWithProviders(<AppointmentCard appointment={buildAppointment({ visitType: 'video' })} />);

    expect(screen.getByText('Video visit')).toBeInTheDocument();
    expect(screen.queryByText('video')).not.toBeInTheDocument();
  });

  it('renders the reason for the visit', () => {
    renderWithProviders(
      <AppointmentCard appointment={buildAppointment({ reason: 'Persistent cough' })} />,
    );

    expect(screen.getByText('Reason')).toBeInTheDocument();
    expect(screen.getByText('Persistent cough')).toBeInTheDocument();
  });

  it('renders the status badge for the appointment status', () => {
    renderWithProviders(<AppointmentCard appointment={buildFor('completed', false)} />);

    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  it('offers both actions for a scheduled, cancellable appointment', () => {
    renderWithProviders(
      <AppointmentCard appointment={buildAppointment()} onReschedule={vi.fn()} onCancel={vi.fn()} />,
    );

    expect(screen.getByTestId('reschedule-apt_001')).toBeEnabled();
    expect(screen.getByTestId('cancel-apt_001')).toBeEnabled();
    expect(screen.queryByTestId('cancel-blocked')).not.toBeInTheDocument();
  });

  it('fires onReschedule with the appointment', async () => {
    const appointment = buildAppointment();
    const onReschedule = vi.fn();
    renderWithProviders(
      <AppointmentCard appointment={appointment} onReschedule={onReschedule} onCancel={vi.fn()} />,
    );

    await userEvent.click(screen.getByTestId('reschedule-apt_001'));

    expect(onReschedule).toHaveBeenCalledTimes(1);
    expect(onReschedule).toHaveBeenCalledWith(appointment);
  });

  it('fires onCancel with the appointment', async () => {
    const appointment = buildAppointment();
    const onCancel = vi.fn();
    renderWithProviders(
      <AppointmentCard appointment={appointment} onReschedule={vi.fn()} onCancel={onCancel} />,
    );

    await userEvent.click(screen.getByTestId('cancel-apt_001'));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledWith(appointment);
  });

  it('renders both action buttons as plain buttons so they never submit a form', () => {
    renderWithProviders(
      <AppointmentCard appointment={buildAppointment()} onReschedule={vi.fn()} onCancel={vi.fn()} />,
    );

    expect(screen.getByTestId('reschedule-apt_001')).toHaveAttribute('type', 'button');
    expect(screen.getByTestId('cancel-apt_001')).toHaveAttribute('type', 'button');
  });

  it('hides the reschedule action when no handler is supplied', () => {
    renderWithProviders(
      <AppointmentCard appointment={buildAppointment()} onCancel={vi.fn()} />,
    );

    expect(screen.queryByTestId('reschedule-apt_001')).not.toBeInTheDocument();
    expect(screen.getByTestId('cancel-apt_001')).toBeInTheDocument();
  });

  it('hides the cancel action when no handler is supplied', () => {
    renderWithProviders(
      <AppointmentCard appointment={buildAppointment()} onReschedule={vi.fn()} />,
    );

    expect(screen.queryByTestId('cancel-apt_001')).not.toBeInTheDocument();
    expect(screen.getByTestId('reschedule-apt_001')).toBeInTheDocument();
  });

  it('renders no actions at all when neither handler is supplied', () => {
    renderWithProviders(<AppointmentCard appointment={buildAppointment()} />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('offers neither action for a completed appointment and explains why', () => {
    renderWithProviders(
      <AppointmentCard
        appointment={buildFor('completed', false)}
        onReschedule={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.queryByTestId('reschedule-apt_001')).not.toBeInTheDocument();
    expect(screen.queryByTestId('cancel-apt_001')).not.toBeInTheDocument();
    expect(screen.getByTestId('cancel-blocked')).toHaveTextContent(
      'Completed visits cannot be cancelled.',
    );
  });

  it('offers neither action for a cancelled appointment and explains why', () => {
    renderWithProviders(
      <AppointmentCard
        appointment={buildFor('cancelled', false)}
        onReschedule={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.queryByTestId('reschedule-apt_001')).not.toBeInTheDocument();
    expect(screen.queryByTestId('cancel-apt_001')).not.toBeInTheDocument();
    expect(screen.getByTestId('cancel-blocked')).toHaveTextContent(
      'This appointment is already cancelled.',
    );
  });

  it('still hides the actions for a completed appointment that is flagged cancellable', () => {
    renderWithProviders(
      <AppointmentCard
        appointment={buildFor('completed', true)}
        onReschedule={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.queryByTestId('reschedule-apt_001')).not.toBeInTheDocument();
    expect(screen.queryByTestId('cancel-apt_001')).not.toBeInTheDocument();
  });

  it('disables the actions of a scheduled but non-cancellable appointment and explains why', async () => {
    const onCancel = vi.fn();
    renderWithProviders(
      <AppointmentCard
        appointment={buildFor('scheduled', false)}
        onReschedule={vi.fn()}
        onCancel={onCancel}
      />,
    );

    expect(screen.getByTestId('reschedule-apt_001')).toBeDisabled();
    expect(screen.getByTestId('cancel-apt_001')).toBeDisabled();
    expect(screen.getByTestId('cancel-blocked')).toHaveTextContent(
      'This appointment can no longer be changed.',
    );

    await userEvent.click(screen.getByTestId('cancel-apt_001'));
    expect(onCancel).not.toHaveBeenCalled();
  });
});
