import { useMemo } from 'react';

import type { Slot } from '../../../api/types';
import { dayKey, formatDayHeading, formatTime } from '../../../shared/formatDateTime';
import { LoadingSpinner } from '../../../shared/LoadingSpinner';

export interface SlotPickerProps {
  slots: Slot[];
  value: string | null;
  onChange: (slotId: string) => void;
  loading?: boolean;
  disabled?: boolean;
  emptyMessage?: string;
  error?: string | null;
}

interface SlotGroup {
  day: string;
  slots: Slot[];
}

const DEFAULT_EMPTY_MESSAGE = 'No open time slots for this provider. Try another provider.';
const LOADING_MESSAGE = 'Loading available times…';

function groupByDay(slots: Slot[]): SlotGroup[] {
  const byDay = new Map<string, Slot[]>();

  for (const slot of slots) {
    const day = dayKey(slot.startsAt);
    const existing = byDay.get(day);
    if (existing) {
      existing.push(slot);
    } else {
      byDay.set(day, [slot]);
    }
  }

  return Array.from(byDay.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([day, daySlots]) => ({
      day,
      slots: [...daySlots].sort((left, right) => left.startsAt.localeCompare(right.startsAt)),
    }));
}

export function SlotPicker({
  slots,
  value,
  onChange,
  loading = false,
  disabled = false,
  emptyMessage,
  error = null,
}: SlotPickerProps) {
  const groups = useMemo(() => groupByDay(slots), [slots]);

  return (
    <div className="slot-picker" data-testid="slot-picker">
      {loading ? <LoadingSpinner label={LOADING_MESSAGE} /> : null}

      {!loading && groups.length === 0 ? (
        <p className="slot-picker__empty" data-testid="slot-picker-empty">
          {emptyMessage ?? DEFAULT_EMPTY_MESSAGE}
        </p>
      ) : null}

      {groups.map((group) => (
        <div className="slot-picker__day" key={group.day}>
          <h4 className="slot-picker__date">{formatDayHeading(group.day)}</h4>
          <div className="slot-picker__times">
            {group.slots.map((slot) => {
              const selected = slot.id === value;
              return (
                <button
                  key={slot.id}
                  type="button"
                  className={selected ? 'slot slot--selected' : 'slot'}
                  disabled={disabled || slot.isBooked}
                  aria-pressed={selected}
                  data-testid={`slot-${slot.id}`}
                  onClick={() => onChange(slot.id)}
                >
                  {formatTime(slot.startsAt)}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {error !== null && error !== '' ? (
        <p className="field__error" data-testid="slot-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
