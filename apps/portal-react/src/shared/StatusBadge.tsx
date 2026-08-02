import type { AppointmentStatus } from '../api/types';

const LABELS: Record<AppointmentStatus, string> = {
  scheduled: 'Scheduled',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export function StatusBadge({ status }: { status: AppointmentStatus }) {
  return (
    <span className={`badge badge--${status}`} data-status={status}>
      {LABELS[status] ?? status}
    </span>
  );
}
