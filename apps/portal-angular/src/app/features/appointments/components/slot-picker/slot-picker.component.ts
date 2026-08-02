import { Component, Input, OnChanges, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

import { Slot } from '../../../../core/models';

interface SlotGroup {
  day: string;
  slots: Slot[];
}

@Component({
  selector: 'ph-slot-picker',
  templateUrl: './slot-picker.component.html',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SlotPickerComponent),
      multi: true,
    },
  ],
})
export class SlotPickerComponent implements ControlValueAccessor, OnChanges {
  @Input() slots: Slot[] = [];
  @Input() loading = false;

  groups: SlotGroup[] = [];
  selectedSlotId: string | null = null;
  disabled = false;

  private onChange: (value: string | null) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  ngOnChanges(): void {
    this.groups = this.groupByDay(this.slots);
  }

  writeValue(value: string | null): void {
    this.selectedSlotId = value;
  }

  registerOnChange(fn: (value: string | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  select(slot: Slot): void {
    if (this.disabled) {
      return;
    }
    this.selectedSlotId = slot.id;
    this.onChange(slot.id);
    this.onTouched();
  }

  private groupByDay(slots: Slot[]): SlotGroup[] {
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
}
