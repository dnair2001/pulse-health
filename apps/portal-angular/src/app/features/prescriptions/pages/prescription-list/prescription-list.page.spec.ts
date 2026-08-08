import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';

import { ApiError, Prescription } from '../../../../core/models';
import { SharedModule } from '../../../../shared/shared.module';
import { PrescriptionsService } from '../../services/prescriptions.service';
import { PrescriptionListPageComponent } from './prescription-list.page';

function prescription(overrides: Partial<Prescription> = {}): Prescription {
  return {
    id: 'rx_001',
    providerId: 'prv_001',
    provider: {
      id: 'prv_001',
      name: 'Dr. Alice Nguyen',
      specialty: 'Primary Care',
      locationName: 'Pulse Health Downtown',
    },
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

describe('PrescriptionListPageComponent', () => {
  let fixture: ComponentFixture<PrescriptionListPageComponent>;
  let component: PrescriptionListPageComponent;
  let prescriptionsService: jasmine.SpyObj<PrescriptionsService>;

  beforeEach(async () => {
    prescriptionsService = jasmine.createSpyObj<PrescriptionsService>('PrescriptionsService', [
      'list',
      'requestRefill',
    ]);

    await TestBed.configureTestingModule({
      declarations: [PrescriptionListPageComponent],
      imports: [SharedModule],
      providers: [{ provide: PrescriptionsService, useValue: prescriptionsService }],
    }).compileComponents();

    fixture = TestBed.createComponent(PrescriptionListPageComponent);
    component = fixture.componentInstance;
  });

  function element(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the loading state while prescriptions are in flight', () => {
    prescriptionsService.list.and.returnValue(new Subject<Prescription[]>());

    fixture.detectChanges();

    expect(element().querySelector('[data-testid="loading-spinner"]')).not.toBeNull();
  });

  it('renders a card per prescription once loaded', () => {
    prescriptionsService.list.and.returnValue(
      of([prescription(), prescription({ id: 'rx_002', medicationName: 'Metformin' })]),
    );

    fixture.detectChanges();

    expect(element().querySelectorAll('.prescription').length).toBe(2);
    expect(
      element().querySelector('[data-testid="prescription-card-rx_001"]')?.textContent,
    ).toContain('Lisinopril');
  });

  it('re-requests the list scoped to the selected tab', () => {
    prescriptionsService.list.and.returnValue(of([prescription()]));
    fixture.detectChanges();

    element().querySelector<HTMLButtonElement>('[data-testid="tab-active"]')?.click();

    expect(prescriptionsService.list).toHaveBeenCalledWith('active');
  });

  it('shows an empty state when there are no prescriptions', () => {
    prescriptionsService.list.and.returnValue(of([]));

    fixture.detectChanges();

    expect(element().querySelector('[data-testid="empty-state"]')).not.toBeNull();
  });

  it('surfaces API errors and retries on demand', () => {
    const failure: ApiError = {
      code: 'NETWORK_ERROR',
      message: 'Cannot reach the Pulse Health API.',
      field: null,
      status: 0,
    };
    prescriptionsService.list.and.returnValue(throwError(() => failure));

    fixture.detectChanges();

    expect(element().querySelector('[data-testid="alert-banner"]')?.textContent).toContain(
      'Cannot reach the Pulse Health API.',
    );

    prescriptionsService.list.and.returnValue(of([prescription()]));
    element().querySelector<HTMLButtonElement>('[data-testid="retry"]')?.click();
    fixture.detectChanges();

    expect(element().querySelectorAll('.prescription').length).toBe(1);
  });

  it('disables the refill button when there are no refills remaining', () => {
    prescriptionsService.list.and.returnValue(of([prescription({ refillsRemaining: 0 })]));

    fixture.detectChanges();

    const button = element().querySelector<HTMLButtonElement>('[data-testid="refill-rx_001"]');
    expect(button?.disabled).toBe(true);
  });

  it('requests a refill and shows a success banner', () => {
    prescriptionsService.list.and.returnValue(of([prescription()]));
    fixture.detectChanges();

    prescriptionsService.requestRefill.and.returnValue(of(prescription({ refillsRemaining: 1 })));
    element().querySelector<HTMLButtonElement>('[data-testid="refill-rx_001"]')?.click();
    fixture.detectChanges();

    expect(prescriptionsService.requestRefill).toHaveBeenCalledOnceWith('rx_001');
    expect(element().querySelector('[data-testid="alert-banner"]')?.textContent).toContain(
      'refill requested',
    );
  });

  it('surfaces a refill error via the banner', () => {
    prescriptionsService.list.and.returnValue(of([prescription({ refillsRemaining: 0 })]));
    fixture.detectChanges();

    const failure: ApiError = {
      code: 'NO_REFILLS_REMAINING',
      message: 'There are no refills remaining. Please contact your provider.',
      field: null,
      status: 409,
    };
    prescriptionsService.requestRefill.and.returnValue(throwError(() => failure));

    component.requestRefill(prescription({ refillsRemaining: 0 }));
    fixture.detectChanges();

    expect(element().querySelector('[data-testid="alert-banner"]')?.textContent).toContain(
      'no refills remaining',
    );
  });
});
