import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { Appointment, AppointmentStatus } from '../../../api/types';
import { formatFullDateTime, formatTimeOfDay } from '../../../shared/formatDateTime';
import { AppointmentCard } from './AppointmentCard';

const BASE: Appointment = {
  id: 'apt_001',
  providerId: 'prv_001',
  provider: {
    id: 'prv_001',
    name: 'Dr Amara Osei',
    specialty: 'Cardiology',
    locationName: 'Central Clinic',
  },
  slotId: 'slt_001',
  startsAt: '2099-03-04T09:00:00Z',
  endsAt: '2099-03-04T09:30:00Z',
  status: 'scheduled',
  visitType: 'video',
  reason: 'Follow-up on blood pressure',
  cancellable: true,
  createdAt: '2099-01-02T08:00:00Z',
  updatedAt: '2099-01-02T08:00:00Z',
};

function appointment(overrides: Partial<Appointment> = {}): Appointment {
  return { ...BASE, ...overrides };
}

function renderCard(overrides: Partial<Appointment> = {}) {
  const onRescheduleRequested = vi.fn();
  const onCancelRequested = vi.fn();
  const value = appointment(overrides);

  render(
    <AppointmentCard
      appointment={value}
      onRescheduleRequested={onRescheduleRequested}
      onCancelRequested={onCancelRequested}
    />,
  );

  return { appointment: value, onRescheduleRequested, onCancelRequested };
}

describe('AppointmentCard', () => {
  it('offers both actions for a scheduled cancellable appointment and emits the appointment', async () => {
    const user = userEvent.setup();
    const { appointment: value, onRescheduleRequested, onCancelRequested } = renderCard();

    expect(screen.getByTestId('appointment-apt_001')).toBeInTheDocument();
    expect(screen.queryByTestId('cancel-blocked')).not.toBeInTheDocument();

    const reschedule = screen.getByTestId('reschedule-apt_001');
    const cancel = screen.getByTestId('cancel-apt_001');
    expect(reschedule).toBeEnabled();
    expect(cancel).toBeEnabled();
    expect(reschedule).toHaveAttribute('type', 'button');
    expect(cancel).toHaveAttribute('type', 'button');

    await user.click(reschedule);
    await user.click(cancel);

    expect(onRescheduleRequested).toHaveBeenCalledTimes(1);
    expect(onRescheduleRequested).toHaveBeenCalledWith(value);
    expect(onCancelRequested).toHaveBeenCalledTimes(1);
    expect(onCancelRequested).toHaveBeenCalledWith(value);
  });

  it('keeps the actions visible but disabled when a scheduled appointment is not cancellable', async () => {
    const user = userEvent.setup();
    const { onRescheduleRequested, onCancelRequested } = renderCard({ cancellable: false });

    const reschedule = screen.getByTestId('reschedule-apt_001');
    const cancel = screen.getByTestId('cancel-apt_001');
    expect(reschedule).toBeDisabled();
    expect(cancel).toBeDisabled();

    await user.click(reschedule);
    await user.click(cancel);

    expect(onRescheduleRequested).not.toHaveBeenCalled();
    expect(onCancelRequested).not.toHaveBeenCalled();
    expect(screen.getByTestId('cancel-blocked')).toHaveTextContent(
      'This appointment can no longer be changed.',
    );
  });

  it('hides the action footer for non-scheduled appointments and explains why', () => {
    const cases: Array<[AppointmentStatus, boolean, string]> = [
      ['completed', false, 'Completed visits cannot be cancelled.'],
      ['completed', true, 'Completed visits cannot be cancelled.'],
      ['cancelled', false, 'This appointment is already cancelled.'],
      ['cancelled', true, 'This appointment is already cancelled.'],
    ];

    for (const [status, cancellable, reason] of cases) {
      const { unmount } = render(
        <AppointmentCard
          appointment={appointment({ status, cancellable })}
          onRescheduleRequested={vi.fn()}
          onCancelRequested={vi.fn()}
        />,
      );

      expect(screen.queryByTestId('reschedule-apt_001')).not.toBeInTheDocument();
      expect(screen.queryByTestId('cancel-apt_001')).not.toBeInTheDocument();
      expect(screen.getByTestId('cancel-blocked')).toHaveTextContent(reason);

      unmount();
    }
  });

  it('renders the provider line, the date range and the visit type label', () => {
    renderCard({ visitType: 'in_person' });

    expect(screen.getByRole('heading', { name: 'Dr Amara Osei' })).toBeInTheDocument();
    expect(screen.getByText('Cardiology · Central Clinic')).toBeInTheDocument();
    expect(screen.getByTestId('appointment-when').textContent).toBe(
      `${formatFullDateTime(BASE.startsAt)} – ${formatTimeOfDay(BASE.endsAt)}`,
    );
    expect(screen.getByText('In person')).toBeInTheDocument();
    expect(screen.getByText('Follow-up on blood pressure')).toBeInTheDocument();
    expect(screen.getByText('Scheduled')).toHaveAttribute('data-status', 'scheduled');
  });
});
