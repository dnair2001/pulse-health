import { useState } from 'react';

import type { AppointmentStatus, VisitType, VisitTypeId } from '../../../api/types';

export interface AppointmentFilterValue {
  status: AppointmentStatus | '';
  visitType: VisitTypeId | '';
}

export interface AppointmentFiltersProps {
  visitTypes: VisitType[];
  disabled?: boolean;
  onFiltersChanged: (value: AppointmentFilterValue) => void;
}

const STATUSES: AppointmentStatus[] = ['scheduled', 'completed', 'cancelled'];

/** Angular renders the raw status through the `titlecase` pipe. */
const STATUS_LABELS: Record<AppointmentStatus, string> = {
  scheduled: 'Scheduled',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export function AppointmentFilters({
  visitTypes,
  disabled = false,
  onFiltersChanged,
}: AppointmentFiltersProps) {
  const [value, setValue] = useState<AppointmentFilterValue>({ status: '', visitType: '' });

  const update = (next: AppointmentFilterValue): void => {
    setValue(next);
    onFiltersChanged(next);
  };

  return (
    <form className="filters" data-testid="appointment-filters">
      <label className="field">
        <span className="field__label">Status</span>
        <select
          value={value.status}
          disabled={disabled}
          onChange={(event) =>
            update({ ...value, status: event.target.value as AppointmentStatus | '' })
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
          disabled={disabled}
          onChange={(event) =>
            update({ ...value, visitType: event.target.value as VisitTypeId | '' })
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
        onClick={() => update({ status: '', visitType: '' })}
        data-testid="filter-reset"
      >
        Clear filters
      </button>
    </form>
  );
}
