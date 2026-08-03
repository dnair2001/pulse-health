import { useMemo } from 'react';

import type { Slot } from '../../../api/types';
import { LoadingSpinner } from '../../../shared/LoadingSpinner';
import { formatDayGroupHeading, formatTimeOfDay } from '../../../shared/formatDateTime';

export interface SlotPickerProps {
  slots: Slot[];
  loading?: boolean;
  value: string | null;
  onChange: (slotId: string | null) => void;
  disabled?: boolean;
}

interface SlotGroup {
  day: string;
  slots: Slot[];
}

/**
 * Port of the Angular component's `groupByDay`: the key is the raw `YYYY-MM-DD` prefix of the
 * UTC `startsAt`, so a slot keeps the Angular grouping even when its local time falls on
 * another day. Both days and the slots inside a day are ordered by string comparison.
 */
function groupByDay(slots: Slot[]): SlotGroup[] {
  const byDay = new Map<string, Slot[]>();

  for (const slot of slots) {
    const day = slot.startsAt.slice(0, 10);
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
  loading = false,
  value,
  onChange,
  disabled = false,
}: SlotPickerProps) {
  const groups = useMemo(() => groupByDay(slots), [slots]);

  const select = (slot: Slot): void => {
    if (disabled) {
      return;
    }
    onChange(slot.id);
  };

  return (
    <div className="slot-picker" data-testid="slot-picker">
      {loading ? <LoadingSpinner message="Loading available times…" /> : null}

      {!loading && groups.length === 0 ? (
        <p className="slot-picker__empty" data-testid="slot-picker-empty">
          No open time slots for this provider. Try another provider.
        </p>
      ) : null}

      {groups.map((group) => (
        <div className="slot-picker__day" key={group.day}>
          <h4 className="slot-picker__date">{formatDayGroupHeading(group.day)}</h4>
          <div className="slot-picker__times">
            {group.slots.map((slot) => (
              <button
                type="button"
                key={slot.id}
                className={slot.id === value ? 'slot slot--selected' : 'slot'}
                disabled={disabled}
                aria-pressed={slot.id === value}
                data-testid={`slot-${slot.id}`}
                onClick={() => select(slot)}
              >
                {formatTimeOfDay(slot.startsAt)}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
