import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { Subject, of, throwError } from 'rxjs';

import {
  Appointment,
  ApiError,
  Invoice,
  PatientProfile,
  Prescription,
} from '../../../../core/models';
import { SharedModule } from '../../../../shared/shared.module';
import { DashboardService } from '../../services/dashboard.service';
import { DashboardPageComponent } from './dashboard.page';

const PROVIDER = {
  id: 'prv_001',
  name: 'Dr. Alice Nguyen',
  specialty: 'Primary Care',
  locationName: 'Pulse Health Downtown',
};

function profile(overrides: Partial<PatientProfile> = {}): PatientProfile {
  return {
    id: 'pat_001',
    name: 'Jordan Reyes',
    dateOfBirth: '1985-06-12',
    ssnLast4: '6789',
    email: 'jordan.reyes@example.com',
    phone: '555-201-3390',
    addressLine: '482 Alder Street',
    city: 'Rivertown',
    state: 'WA',
    postalCode: '98033',
    emergencyContactName: 'Sam Reyes',
    emergencyContactPhone: '555-201-9981',
    ...overrides,
  };
}

function appointment(overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: 'apt_001',
    providerId: 'prv_001',
    provider: PROVIDER,
    slotId: 'slt_prv_001_20990101T0900',
    startsAt: '2099-01-01T09:00:00Z',
    endsAt: '2099-01-01T09:30:00Z',
    status: 'scheduled',
    visitType: 'in_person',
    reason: 'Annual physical',
    cancellable: true,
    createdAt: '2098-12-01T00:00:00Z',
    updatedAt: '2098-12-01T00:00:00Z',
    ...overrides,
  };
}

function prescription(overrides: Partial<Prescription> = {}): Prescription {
  return {
    id: 'rx_001',
    providerId: 'prv_001',
    provider: PROVIDER,
    medicationName: 'Lisinopril',
    dosage: '10mg',
    frequency: 'Once daily',
    instructions: 'Take at the same time each morning.',
    status: 'active',
    refillsRemaining: 2,
    lastFilledAt: '2099-01-01T00:00:00Z',
    createdAt: '2098-12-01T00:00:00Z',
    updatedAt: '2099-01-01T00:00:00Z',
    ...overrides,
  };
}

function invoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 'inv_001',
    providerId: 'prv_001',
    provider: PROVIDER,
    serviceDescription: 'Annual physical',
    billedAmountCents: 42000,
    insurancePaidCents: 33600,
    patientResponsibilityCents: 8400,
    amountPaidCents: 0,
    balanceCents: 8400,
    status: 'open',
    overdue: false,
    dueDate: '2099-01-20',
    issuedAt: '2099-01-01T00:00:00Z',
    updatedAt: '2099-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('DashboardPageComponent', () => {
  let fixture: ComponentFixture<DashboardPageComponent>;
  let dashboardService: jasmine.SpyObj<DashboardService>;

  beforeEach(async () => {
    dashboardService = jasmine.createSpyObj<DashboardService>('DashboardService', [
      'myProfile',
      'upcomingAppointments',
      'activePrescriptions',
      'openInvoices',
    ]);

    await TestBed.configureTestingModule({
      declarations: [DashboardPageComponent],
      imports: [SharedModule, RouterTestingModule],
      providers: [{ provide: DashboardService, useValue: dashboardService }],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardPageComponent);
  });

  function element(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function stubEverything(
    overrides: {
      profile?: PatientProfile;
      appointments?: Appointment[];
      prescriptions?: Prescription[];
      invoices?: Invoice[];
    } = {},
  ): void {
    dashboardService.myProfile.and.returnValue(of(overrides.profile ?? profile()));
    dashboardService.upcomingAppointments.and.returnValue(of(overrides.appointments ?? []));
    dashboardService.activePrescriptions.and.returnValue(of(overrides.prescriptions ?? []));
    dashboardService.openInvoices.and.returnValue(of(overrides.invoices ?? []));
  }

  it('shows the loading state while the summary is in flight', () => {
    dashboardService.myProfile.and.returnValue(new Subject<PatientProfile>());
    dashboardService.upcomingAppointments.and.returnValue(of([]));
    dashboardService.activePrescriptions.and.returnValue(of([]));
    dashboardService.openInvoices.and.returnValue(of([]));

    fixture.detectChanges();

    expect(element().querySelector('[data-testid="loading-spinner"]')).not.toBeNull();
  });

  it('greets the patient by name once loaded', () => {
    stubEverything();

    fixture.detectChanges();

    expect(element().querySelector('.page__title')?.textContent).toContain('Jordan Reyes');
  });

  it('shows the next upcoming appointment', () => {
    stubEverything({ appointments: [appointment({ reason: 'Follow-up visit' })] });

    fixture.detectChanges();

    expect(element().querySelector('[data-testid="next-appointment-card"]')?.textContent).toContain(
      'Follow-up visit',
    );
  });

  it('shows a fallback when there is no upcoming appointment', () => {
    stubEverything({ appointments: [] });

    fixture.detectChanges();

    expect(element().querySelector('[data-testid="next-appointment-card"]')?.textContent).toContain(
      'No upcoming appointments',
    );
  });

  it('flags prescriptions that are running low on refills', () => {
    stubEverything({
      prescriptions: [prescription({ refillsRemaining: 0 }), prescription({ id: 'rx_002' })],
    });

    fixture.detectChanges();

    expect(element().querySelector('[data-testid="refill-soon-count"]')?.textContent).toContain(
      '1',
    );
  });

  it('totals the outstanding balance across open invoices and flags overdue ones', () => {
    stubEverything({
      invoices: [
        invoice({ balanceCents: 8400 }),
        invoice({ id: 'inv_002', balanceCents: 5000, overdue: true }),
      ],
    });

    fixture.detectChanges();

    expect(element().querySelector('[data-testid="open-balance"]')?.textContent).toContain(
      '134.00',
    );
    expect(element().querySelector('[data-testid="overdue-invoice-count"]')?.textContent).toContain(
      '1',
    );
  });

  it('surfaces an error and retries on demand', () => {
    const failure: ApiError = {
      code: 'NETWORK_ERROR',
      message: 'Cannot reach the Pulse Health API.',
      field: null,
      status: 0,
    };
    dashboardService.myProfile.and.returnValue(throwError(() => failure));
    dashboardService.upcomingAppointments.and.returnValue(of([]));
    dashboardService.activePrescriptions.and.returnValue(of([]));
    dashboardService.openInvoices.and.returnValue(of([]));

    fixture.detectChanges();

    expect(element().querySelector('[data-testid="alert-banner"]')?.textContent).toContain(
      'Cannot reach the Pulse Health API.',
    );

    stubEverything();
    element().querySelector<HTMLButtonElement>('[data-testid="retry"]')?.click();
    fixture.detectChanges();

    expect(element().querySelector('[data-testid="next-appointment-card"]')).not.toBeNull();
  });
});
