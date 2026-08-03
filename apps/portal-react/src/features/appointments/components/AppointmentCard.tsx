import type { Appointment } from '../../../api/types';
import { StatusBadge } from '../../../shared/StatusBadge';
import { formatFullDateTime, formatTimeOfDay } from '../../../shared/formatDateTime';
import { visitTypeLabel } from '../../../shared/visitTypeLabel';

export interface AppointmentCardProps {
  appointment: Appointment;
  onRescheduleRequested: (appointment: Appointment) => void;
  onCancelRequested: (appointment: Appointment) => void;
}

function cancelBlockedReason(appointment: Appointment, canModify: boolean): string | null {
  if (canModify) {
    return null;
  }
  if (appointment.status === 'completed') {
    return 'Completed visits cannot be cancelled.';
  }
  if (appointment.status === 'cancelled') {
    return 'This appointment is already cancelled.';
  }
  return 'This appointment can no longer be changed.';
}

export function AppointmentCard({
  appointment,
  onRescheduleRequested,
  onCancelRequested,
}: AppointmentCardProps) {
  const canModify = appointment.status === 'scheduled' && appointment.cancellable;
  const blockedReason = cancelBlockedReason(appointment, canModify);

  return (
    <article className="card appointment" data-testid={`appointment-${appointment.id}`}>
      <header className="appointment__header">
        <div>
          <h3 className="appointment__provider">{appointment.provider.name}</h3>
          <p className="appointment__specialty">
            {`${appointment.provider.specialty} · ${appointment.provider.locationName}`}
          </p>
        </div>
        <StatusBadge status={appointment.status} />
      </header>

      <dl className="appointment__details">
        <div>
          <dt>When</dt>
          <dd data-testid="appointment-when">
            {`${formatFullDateTime(appointment.startsAt)} – ${formatTimeOfDay(appointment.endsAt)}`}
          </dd>
        </div>
        <div>
          <dt>Visit type</dt>
          <dd>{visitTypeLabel(appointment.visitType)}</dd>
        </div>
        <div>
          <dt>Reason</dt>
          <dd>{appointment.reason}</dd>
        </div>
      </dl>

      {appointment.status === 'scheduled' ? (
        <footer className="appointment__actions">
          <button
            type="button"
            className="button button--ghost"
            disabled={!canModify}
            onClick={() => onRescheduleRequested(appointment)}
            data-testid={`reschedule-${appointment.id}`}
          >
            Reschedule
          </button>
          <button
            type="button"
            className="button button--danger"
            disabled={!canModify}
            onClick={() => onCancelRequested(appointment)}
            data-testid={`cancel-${appointment.id}`}
          >
            Cancel
          </button>
        </footer>
      ) : null}

      {blockedReason ? (
        <p className="appointment__blocked" data-testid="cancel-blocked">
          {blockedReason}
        </p>
      ) : null}
    </article>
  );
}
