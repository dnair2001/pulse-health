import type { AppointmentStatus, VisitType, VisitTypeId } from '../../../api/types';

export interface AppointmentFiltersValue {
  status: AppointmentStatus | '';
  visitType: VisitTypeId | '';
}

export interface AppointmentFiltersProps {
  value: AppointmentFiltersValue;
  visitTypes: VisitType[];
  onChange: (value: AppointmentFiltersValue) => void;
  onClear: () => void;
}

const STATUSES: readonly AppointmentStatus[] = ['scheduled', 'completed', 'cancelled'];

/** The Angular template ran each status through the `titlecase` pipe. */
const STATUS_LABELS: Record<AppointmentStatus, string> = {
  scheduled: 'Scheduled',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export function AppointmentFilters({
  value,
  visitTypes,
  onChange,
  onClear,
}: AppointmentFiltersProps) {
  return (
    <form className="filters" data-testid="appointment-filters">
      <label className="field">
        <span className="field__label">Status</span>
        <select
          value={value.status}
          onChange={(event) =>
            onChange({
              status: event.target.value as AppointmentStatus | '',
              visitType: value.visitType,
            })
          }
          data-testid="filter-status"
        >
          <option value="">All statuses</option>
          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span className="field__label">Visit type</span>
        <select
          value={value.visitType}
          onChange={(event) =>
            onChange({
              status: value.status,
              visitType: event.target.value as VisitTypeId | '',
            })
          }
          data-testid="filter-visit-type"
        >
          <option value="">All visit types</option>
          {visitTypes.map((visitType) => (
            <option key={visitType.id} value={visitType.id}>
              {visitType.label}
            </option>
          ))}
        </select>
      </label>

      <button
        type="button"
        className="button button--ghost"
        onClick={onClear}
        data-testid="filter-reset"
      >
        Clear filters
      </button>
    </form>
  );
}
