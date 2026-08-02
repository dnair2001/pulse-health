import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError } from 'rxjs';

import { ApiError, Appointment, Provider, Slot, VisitType } from '../../../../core/models';
import { NotificationService } from '../../../../core/services/notification.service';
import { SharedModule } from '../../../../shared/shared.module';
import { SlotPickerComponent } from '../../components/slot-picker/slot-picker.component';
import { AppointmentsService } from '../../services/appointments.service';
import { ProvidersService } from '../../services/providers.service';
import { SlotsService } from '../../services/slots.service';
import { AppointmentSchedulePageComponent } from './appointment-schedule.page';

const PROVIDERS: Provider[] = [
  {
    id: 'prv_001',
    name: 'Dr. Alice Nguyen',
    specialty: 'Primary Care',
    credentials: 'MD',
    locationName: 'Pulse Health Downtown',
  },
];

const VISIT_TYPES: VisitType[] = [{ id: 'in_person', label: 'In person', durationMinutes: 30 }];

const SLOTS: Slot[] = [
  {
    id: 'slt_001',
    providerId: 'prv_001',
    startsAt: '2099-01-05T09:00:00Z',
    endsAt: '2099-01-05T09:30:00Z',
    isBooked: false,
  },
];

const CREATED: Appointment = {
  id: 'apt_001',
  providerId: 'prv_001',
  provider: {
    id: 'prv_001',
    name: 'Dr. Alice Nguyen',
    specialty: 'Primary Care',
    locationName: 'Pulse Health Downtown',
  },
  slotId: 'slt_001',
  startsAt: '2099-01-05T09:00:00Z',
  endsAt: '2099-01-05T09:30:00Z',
  status: 'scheduled',
  visitType: 'in_person',
  reason: 'Annual physical',
  cancellable: true,
  createdAt: '2099-01-01T00:00:00Z',
  updatedAt: '2099-01-01T00:00:00Z',
};

describe('AppointmentSchedulePageComponent', () => {
  let fixture: ComponentFixture<AppointmentSchedulePageComponent>;
  let component: AppointmentSchedulePageComponent;
  let appointmentsService: jasmine.SpyObj<AppointmentsService>;
  let providersService: jasmine.SpyObj<ProvidersService>;
  let slotsService: jasmine.SpyObj<SlotsService>;
  let notifications: NotificationService;
  let navigate: jasmine.Spy;

  beforeEach(async () => {
    appointmentsService = jasmine.createSpyObj<AppointmentsService>('AppointmentsService', [
      'schedule',
    ]);
    providersService = jasmine.createSpyObj<ProvidersService>('ProvidersService', [
      'list',
      'visitTypes',
    ]);
    slotsService = jasmine.createSpyObj<SlotsService>('SlotsService', ['list']);

    providersService.list.and.returnValue(of(PROVIDERS));
    providersService.visitTypes.and.returnValue(of(VISIT_TYPES));
    slotsService.list.and.returnValue(of(SLOTS));

    await TestBed.configureTestingModule({
      declarations: [AppointmentSchedulePageComponent, SlotPickerComponent],
      imports: [SharedModule, ReactiveFormsModule, RouterTestingModule],
      providers: [
        { provide: AppointmentsService, useValue: appointmentsService },
        { provide: ProvidersService, useValue: providersService },
        { provide: SlotsService, useValue: slotsService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AppointmentSchedulePageComponent);
    component = fixture.componentInstance;
    notifications = TestBed.inject(NotificationService);
    navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
  });

  function element(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function chooseProvider(providerId: string): void {
    const select = element().querySelector<HTMLSelectElement>('[data-testid="provider-select"]');
    if (!select) {
      throw new Error('provider select was not rendered');
    }
    select.value = providerId;
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  function submit(): void {
    element().querySelector<HTMLButtonElement>('[data-testid="submit-appointment"]')?.click();
    fixture.detectChanges();
  }

  it('loads providers and visit types on init', () => {
    fixture.detectChanges();

    expect(providersService.list).toHaveBeenCalled();
    expect(component.providers).toEqual(PROVIDERS);
    expect(component.visitTypes).toEqual(VISIT_TYPES);
  });

  it('loads available slots when a provider is chosen', () => {
    fixture.detectChanges();
    chooseProvider('prv_001');

    expect(slotsService.list).toHaveBeenCalledOnceWith({ providerId: 'prv_001' });
    expect(element().querySelector('[data-testid="slot-slt_001"]')).not.toBeNull();
  });

  it('refuses to submit an empty form and reports the missing reason', () => {
    fixture.detectChanges();
    submit();

    expect(appointmentsService.schedule).not.toHaveBeenCalled();
    expect(element().querySelector('[data-testid="reason-error"]')?.textContent).toContain(
      'A reason for the visit is required.'
    );
    expect(element().querySelector('[data-testid="slot-error"]')).not.toBeNull();
  });

  it('treats a whitespace-only reason as missing', () => {
    fixture.detectChanges();
    component.form.setValue({
      providerId: 'prv_001',
      slotId: 'slt_001',
      visitType: 'in_person',
      reason: '   ',
    });
    fixture.detectChanges();

    expect(component.form.invalid).toBeTrue();

    submit();
    expect(appointmentsService.schedule).not.toHaveBeenCalled();
  });

  it('submits trimmed values, flags success, and returns to the list', () => {
    appointmentsService.schedule.and.returnValue(of(CREATED));
    const success = spyOn(notifications, 'success').and.callThrough();

    fixture.detectChanges();
    component.form.setValue({
      providerId: 'prv_001',
      slotId: 'slt_001',
      visitType: 'in_person',
      reason: '  Annual physical  ',
    });
    fixture.detectChanges();
    submit();

    expect(appointmentsService.schedule).toHaveBeenCalledOnceWith({
      providerId: 'prv_001',
      slotId: 'slt_001',
      visitType: 'in_person',
      reason: 'Annual physical',
    });
    expect(success).toHaveBeenCalledWith('Appointment scheduled.');
    expect(navigate).toHaveBeenCalledWith(['/appointments']);
  });

  it('maps a double-booked slot onto the slot field and refreshes availability', () => {
    const failure: ApiError = {
      code: 'SLOT_ALREADY_BOOKED',
      message: 'That time slot has just been taken. Please pick another.',
      field: 'slotId',
      status: 409,
    };
    appointmentsService.schedule.and.returnValue(throwError(() => failure));

    fixture.detectChanges();
    chooseProvider('prv_001');
    // patch rather than set, so the provider control does not re-emit and reload slots
    component.form.patchValue({
      slotId: 'slt_001',
      visitType: 'in_person',
      reason: 'Annual physical',
    });
    fixture.detectChanges();
    submit();

    expect(element().querySelector('[data-testid="alert-banner"]')?.textContent).toContain(
      'That time slot has just been taken.'
    );
    expect(element().querySelector('[data-testid="slot-server-error"]')).not.toBeNull();
    expect(component.form.controls['slotId'].value).toBe('');
    // once for the provider choice, once because the booking failed
    expect(slotsService.list).toHaveBeenCalledTimes(2);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('shows a validation error returned by the API against its field', () => {
    const failure: ApiError = {
      code: 'VALIDATION_ERROR',
      message: 'A reason for the visit is required.',
      field: 'reason',
      status: 422,
    };
    appointmentsService.schedule.and.returnValue(throwError(() => failure));

    fixture.detectChanges();
    component.form.setValue({
      providerId: 'prv_001',
      slotId: 'slt_001',
      visitType: 'in_person',
      reason: 'Annual physical',
    });
    fixture.detectChanges();
    submit();

    expect(component.form.controls['reason'].hasError('server')).toBeTrue();
    expect(component.serverMessageFor('reason')).toBe('A reason for the visit is required.');
  });

  it('surfaces a failure to load providers', () => {
    const failure: ApiError = {
      code: 'NETWORK_ERROR',
      message: 'Cannot reach the Pulse Health API.',
      field: null,
      status: 0,
    };
    providersService.list.and.returnValue(throwError(() => failure));

    fixture.detectChanges();

    expect(element().querySelector('[data-testid="alert-banner"]')?.textContent).toContain(
      'Cannot reach the Pulse Health API.'
    );
  });
});
