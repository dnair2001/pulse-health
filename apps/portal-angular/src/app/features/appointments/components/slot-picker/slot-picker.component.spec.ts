import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Slot } from '../../../../core/models';
import { SharedModule } from '../../../../shared/shared.module';
import { SlotPickerComponent } from './slot-picker.component';

const SLOTS: Slot[] = [
  {
    id: 'slt_b',
    providerId: 'prv_001',
    startsAt: '2099-01-06T09:00:00Z',
    endsAt: '2099-01-06T09:30:00Z',
    isBooked: false,
  },
  {
    id: 'slt_a',
    providerId: 'prv_001',
    startsAt: '2099-01-05T14:00:00Z',
    endsAt: '2099-01-05T14:30:00Z',
    isBooked: false,
  },
  {
    id: 'slt_c',
    providerId: 'prv_001',
    startsAt: '2099-01-05T09:00:00Z',
    endsAt: '2099-01-05T09:30:00Z',
    isBooked: false,
  },
];

describe('SlotPickerComponent', () => {
  let fixture: ComponentFixture<SlotPickerComponent>;
  let component: SlotPickerComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [SlotPickerComponent],
      imports: [SharedModule],
    }).compileComponents();

    fixture = TestBed.createComponent(SlotPickerComponent);
    component = fixture.componentInstance;
  });

  function setSlots(slots: Slot[]): void {
    component.slots = slots;
    component.ngOnChanges();
    fixture.detectChanges();
  }

  it('groups slots by day and orders both days and times', () => {
    setSlots(SLOTS);

    expect(component.groups.map((group) => group.day)).toEqual(['2099-01-05', '2099-01-06']);
    expect(component.groups[0].slots.map((slot) => slot.id)).toEqual(['slt_c', 'slt_a']);
  });

  it('shows an empty message when there are no slots and it is not loading', () => {
    setSlots([]);

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('[data-testid="slot-picker-empty"]')).not.toBeNull();
  });

  it('shows the spinner instead of the empty message while loading', () => {
    component.loading = true;
    setSlots([]);

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('[data-testid="loading-spinner"]')).not.toBeNull();
    expect(element.querySelector('[data-testid="slot-picker-empty"]')).toBeNull();
  });

  it('propagates the chosen slot through ControlValueAccessor', () => {
    const onChange = jasmine.createSpy('onChange');
    const onTouched = jasmine.createSpy('onTouched');
    component.registerOnChange(onChange);
    component.registerOnTouched(onTouched);
    setSlots(SLOTS);

    const button = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      '[data-testid="slot-slt_c"]',
    );
    button?.click();
    fixture.detectChanges();

    expect(onChange).toHaveBeenCalledWith('slt_c');
    expect(onTouched).toHaveBeenCalled();
    expect(component.selectedSlotId).toBe('slt_c');
  });

  it('reflects an externally written value and ignores clicks when disabled', () => {
    const onChange = jasmine.createSpy('onChange');
    component.registerOnChange(onChange);
    component.writeValue('slt_a');
    component.setDisabledState(true);
    setSlots(SLOTS);

    expect(component.selectedSlotId).toBe('slt_a');

    component.select(SLOTS[0]);
    expect(onChange).not.toHaveBeenCalled();
    expect(component.selectedSlotId).toBe('slt_a');
  });
});
