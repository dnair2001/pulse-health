export type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled';

export interface StatusBadgeProps {
  status?: AppointmentStatus;
}

function statusLabel(status: AppointmentStatus): string {
  switch (status) {
    case 'scheduled':
      return 'Scheduled';
    case 'completed':
      return 'Completed';
    case 'cancelled':
      return 'Cancelled';
    default:
      return status;
  }
}

export function StatusBadge({ status = 'scheduled' }: StatusBadgeProps) {
  return (
    <span className={`badge badge--${status}`} data-status={status}>
      {statusLabel(status)}
    </span>
  );
}
