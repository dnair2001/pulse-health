import type { Appointment } from '../../../api/types';
import { StatusBadge } from '../../../shared/StatusBadge';
import { formatLongWhen, formatTime } from '../../../shared/formatDateTime';
import { visitTypeLabel } from '../../../shared/visitTypeLabel';

export interface AppointmentCardProps {
  appointment: Appointment;
  onReschedule?: (appointment: Appointment) => void;
  onCancel?: (appointment: Appointment) => void;
}

function blockedReasonFor(appointment: Appointment, canModify: boolean): string | null {
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

export function AppointmentCard({ appointment, onReschedule, onCancel }: AppointmentCardProps) {
  const canModify = appointment.status === 'scheduled' && appointment.cancellable;
  const blockedReason = blockedReasonFor(appointment, canModify);
  const showActions =
    appointment.status === 'scheduled' && (onReschedule !== undefined || onCancel !== undefined);

  return (
    <article className="card appointment" data-testid={`appointment-${appointment.id}`}>
      <header className="appointment__header">
        <div>
          <h3 className="appointment__provider">{appointment.provider.name}</h3>
          <p className="appointment__specialty">
            {appointment.provider.specialty} · {appointment.provider.locationName}
          </p>
        </div>
        <StatusBadge status={appointment.status} />
      </header>

      <dl className="appointment__details">
        <div>
          <dt>When</dt>
          <dd data-testid="appointment-when">
            {formatLongWhen(appointment.startsAt)} – {formatTime(appointment.endsAt)}
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

      {showActions ? (
        <footer className="appointment__actions">
          {onReschedule ? (
            <button
              type="button"
              className="button button--ghost"
              disabled={!canModify}
              onClick={() => onReschedule(appointment)}
              data-testid={`reschedule-${appointment.id}`}
            >
              Reschedule
            </button>
          ) : null}
          {onCancel ? (
            <button
              type="button"
              className="button button--danger"
              disabled={!canModify}
              onClick={() => onCancel(appointment)}
              data-testid={`cancel-${appointment.id}`}
            >
              Cancel
            </button>
          ) : null}
        </footer>
      ) : null}

      {blockedReason !== null ? (
        <p className="appointment__blocked" data-testid="cancel-blocked">
          {blockedReason}
        </p>
      ) : null}
    </article>
  );
}
