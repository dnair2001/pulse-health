import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing';
import { Subject, of, throwError } from 'rxjs';

import { ApiError, Appointment, AppointmentQuery, VisitType } from '../../../../core/models';
import { SharedModule } from '../../../../shared/shared.module';
import { AppointmentCardComponent } from '../../components/appointment-card/appointment-card.component';
import { AppointmentFiltersComponent } from '../../components/appointment-filters/appointment-filters.component';
import { AppointmentsService } from '../../services/appointments.service';
import { ProvidersService } from '../../services/providers.service';
import { AppointmentListPageComponent } from './appointment-list.page';

const VISIT_TYPES: VisitType[] = [
  { id: 'in_person', label: 'In person', durationMinutes: 30 },
  { id: 'video', label: 'Video visit', durationMinutes: 20 },
];

function appointment(overrides: Partial<Appointment> = {}): Appointment {
  return {
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
    ...overrides,
  };
}

describe('AppointmentListPageComponent', () => {
  let fixture: ComponentFixture<AppointmentListPageComponent>;
  let component: AppointmentListPageComponent;
  let appointmentsService: jasmine.SpyObj<AppointmentsService>;
  let providersService: jasmine.SpyObj<ProvidersService>;

  beforeEach(async () => {
    appointmentsService = jasmine.createSpyObj<AppointmentsService>('AppointmentsService', [
      'list',
      'cancel',
    ]);
    providersService = jasmine.createSpyObj<ProvidersService>('ProvidersService', ['visitTypes']);
    providersService.visitTypes.and.returnValue(of(VISIT_TYPES));

    await TestBed.configureTestingModule({
      declarations: [
        AppointmentListPageComponent,
        AppointmentCardComponent,
        AppointmentFiltersComponent,
      ],
      imports: [SharedModule, ReactiveFormsModule, RouterTestingModule],
      providers: [
        { provide: AppointmentsService, useValue: appointmentsService },
        { provide: ProvidersService, useValue: providersService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AppointmentListPageComponent);
    component = fixture.componentInstance;
  });

  function element(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function click(testId: string): void {
    element().querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`)?.click();
    fixture.detectChanges();
  }

  function lastQuery(): AppointmentQuery {
    const query = appointmentsService.list.calls.mostRecent().args[0];
    if (!query) {
      throw new Error('expected the appointments list to be requested with a query');
    }
    return query;
  }

  it('shows the loading state while appointments are in flight', () => {
    appointmentsService.list.and.returnValue(new Subject<Appointment[]>());

    fixture.detectChanges();

    expect(element().querySelector('[data-testid="loading-spinner"]')).not.toBeNull();
    expect(component.loading).toBeTrue();
  });

  it('renders a card per appointment once loaded', () => {
    appointmentsService.list.and.returnValue(
      of([appointment(), appointment({ id: 'apt_002', reason: 'Follow-up' })])
    );

    fixture.detectChanges();

    expect(element().querySelectorAll('.appointment').length).toBe(2);
    expect(element().querySelector('[data-testid="appointment-apt_001"]')?.textContent).toContain(
      'Dr. Alice Nguyen'
    );
    expect(element().querySelector('[data-testid="loading-spinner"]')).toBeNull();
  });

  it('requests the upcoming scope on load and the past scope when that tab is chosen', () => {
    appointmentsService.list.and.returnValue(of([]));

    fixture.detectChanges();
    expect(lastQuery().scope).toBe('upcoming');

    click('tab-past');
    expect(lastQuery().scope).toBe('past');
    expect(component.scope).toBe('past');
  });

  it('shows an empty state with a call to action when there are no upcoming appointments', () => {
    appointmentsService.list.and.returnValue(of([]));

    fixture.detectChanges();

    const empty = element().querySelector('[data-testid="empty-state"]');
    expect(empty?.textContent).toContain('No upcoming appointments');
    expect(element().querySelector('[data-testid="empty-state-action"]')).not.toBeNull();
  });

  it('reloads with the chosen status filter and reports a filtered empty state', () => {
    appointmentsService.list.and.returnValue(of([]));
    fixture.detectChanges();

    const select = element().querySelector<HTMLSelectElement>('[data-testid="filter-status"]');
    if (!select) {
      throw new Error('status filter was not rendered');
    }
    select.value = 'completed';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(lastQuery().status).toEqual(['completed']);
    expect(element().querySelector('[data-testid="empty-state"]')?.textContent).toContain(
      'No appointments match these filters'
    );
  });

  it('surfaces API errors and retries on demand', () => {
    const failure: ApiError = {
      code: 'NETWORK_ERROR',
      message: 'Cannot reach the Pulse Health API.',
      field: null,
      status: 0,
    };
    appointmentsService.list.and.returnValue(throwError(() => failure));

    fixture.detectChanges();

    expect(element().querySelector('[data-testid="alert-banner"]')?.textContent).toContain(
      'Cannot reach the Pulse Health API.'
    );

    appointmentsService.list.and.returnValue(of([appointment()]));
    click('retry');

    expect(element().querySelectorAll('.appointment').length).toBe(1);
    expect(element().querySelector('[data-testid="alert-banner"]')).toBeNull();
  });

  it('cancels an appointment only after the confirmation is accepted', () => {
    appointmentsService.list.and.returnValue(of([appointment()]));
    appointmentsService.cancel.and.returnValue(
      of(appointment({ status: 'cancelled', cancellable: false }))
    );

    fixture.detectChanges();
    click('cancel-apt_001');

    expect(element().querySelector('[data-testid="confirm-dialog"]')).not.toBeNull();
    expect(appointmentsService.cancel).not.toHaveBeenCalled();

    click('confirm-accept');

    expect(appointmentsService.cancel).toHaveBeenCalledOnceWith('apt_001');
    expect(element().querySelector('[data-testid="confirm-dialog"]')).toBeNull();
    expect(element().querySelector('[data-testid="alert-banner"]')?.textContent).toContain(
      'Appointment cancelled.'
    );
    expect(appointmentsService.list).toHaveBeenCalledTimes(2);
  });

  it('keeps the appointment when the confirmation is dismissed', () => {
    appointmentsService.list.and.returnValue(of([appointment()]));

    fixture.detectChanges();
    click('cancel-apt_001');
    click('confirm-cancel');

    expect(appointmentsService.cancel).not.toHaveBeenCalled();
    expect(element().querySelector('[data-testid="confirm-dialog"]')).toBeNull();
  });

  it('shows the API message when cancelling is rejected', () => {
    const failure: ApiError = {
      code: 'APPOINTMENT_NOT_CANCELLABLE',
      message: 'Completed appointments cannot be cancelled.',
      field: null,
      status: 409,
    };
    appointmentsService.list.and.returnValue(of([appointment()]));
    appointmentsService.cancel.and.returnValue(throwError(() => failure));

    fixture.detectChanges();
    click('cancel-apt_001');
    click('confirm-accept');

    expect(element().querySelector('[data-testid="alert-banner"]')?.textContent).toContain(
      'Completed appointments cannot be cancelled.'
    );
  });

  it('explains why a completed appointment cannot be cancelled', () => {
    appointmentsService.list.and.returnValue(
      of([appointment({ status: 'completed', cancellable: false })])
    );

    fixture.detectChanges();

    expect(element().querySelector('[data-testid="cancel-blocked"]')?.textContent).toContain(
      'Completed visits cannot be cancelled.'
    );
    expect(element().querySelector('[data-testid="cancel-apt_001"]')).toBeNull();
  });
});
