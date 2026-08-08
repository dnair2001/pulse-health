import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { Subject, of, throwError } from 'rxjs';

import { ApiError, Invoice } from '../../../../core/models';
import { SharedModule } from '../../../../shared/shared.module';
import { BillingService } from '../../services/billing.service';
import { InvoiceListPageComponent } from './invoice-list.page';

function invoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 'inv_001',
    providerId: 'prv_001',
    provider: {
      id: 'prv_001',
      name: 'Dr. Alice Nguyen',
      specialty: 'Primary Care',
      locationName: 'Pulse Health Downtown',
    },
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

describe('InvoiceListPageComponent', () => {
  let fixture: ComponentFixture<InvoiceListPageComponent>;
  let component: InvoiceListPageComponent;
  let billingService: jasmine.SpyObj<BillingService>;

  beforeEach(async () => {
    billingService = jasmine.createSpyObj<BillingService>('BillingService', [
      'list',
      'recordPayment',
    ]);

    await TestBed.configureTestingModule({
      declarations: [InvoiceListPageComponent],
      imports: [SharedModule, ReactiveFormsModule],
      providers: [{ provide: BillingService, useValue: billingService }],
    }).compileComponents();

    fixture = TestBed.createComponent(InvoiceListPageComponent);
    component = fixture.componentInstance;
  });

  function element(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the loading state while invoices are in flight', () => {
    billingService.list.and.returnValue(new Subject<Invoice[]>());

    fixture.detectChanges();

    expect(element().querySelector('[data-testid="loading-spinner"]')).not.toBeNull();
  });

  it('renders a card per invoice once loaded', () => {
    billingService.list.and.returnValue(
      of([invoice(), invoice({ id: 'inv_002', serviceDescription: 'Dermatology follow-up' })]),
    );

    fixture.detectChanges();

    expect(element().querySelectorAll('.invoice').length).toBe(2);
    expect(element().querySelector('[data-testid="invoice-card-inv_001"]')?.textContent).toContain(
      'Annual physical',
    );
  });

  it('flags an overdue balance with a badge', () => {
    billingService.list.and.returnValue(of([invoice({ overdue: true })]));

    fixture.detectChanges();

    expect(element().querySelector('[data-testid="overdue-badge"]')).not.toBeNull();
  });

  it('re-requests the list scoped to the selected tab', () => {
    billingService.list.and.returnValue(of([invoice()]));
    fixture.detectChanges();

    element().querySelector<HTMLButtonElement>('[data-testid="tab-paid"]')?.click();

    expect(billingService.list).toHaveBeenCalledWith('paid');
  });

  it('shows an empty state when there are no invoices', () => {
    billingService.list.and.returnValue(of([]));

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
    billingService.list.and.returnValue(throwError(() => failure));

    fixture.detectChanges();

    expect(element().querySelector('[data-testid="alert-banner"]')?.textContent).toContain(
      'Cannot reach the Pulse Health API.',
    );

    billingService.list.and.returnValue(of([invoice()]));
    element().querySelector<HTMLButtonElement>('[data-testid="retry"]')?.click();
    fixture.detectChanges();

    expect(element().querySelectorAll('.invoice').length).toBe(1);
  });

  it('opens a payment form pre-filled with the outstanding balance', () => {
    billingService.list.and.returnValue(of([invoice({ balanceCents: 8400 })]));
    fixture.detectChanges();

    element().querySelector<HTMLButtonElement>('[data-testid="pay-balance-inv_001"]')?.click();
    fixture.detectChanges();

    const input = element().querySelector<HTMLInputElement>('[data-testid="payment-amount-input"]');
    expect(input?.value).toBe('84.00');
  });

  it('submits a payment and shows a success banner', () => {
    billingService.list.and.returnValue(of([invoice({ balanceCents: 8400 })]));
    fixture.detectChanges();
    billingService.recordPayment.and.returnValue(of(invoice({ status: 'paid', balanceCents: 0 })));

    component.startPayment(invoice({ balanceCents: 8400 }));
    fixture.detectChanges();
    component.submitPayment(invoice({ balanceCents: 8400 }));
    fixture.detectChanges();

    expect(billingService.recordPayment).toHaveBeenCalledOnceWith('inv_001', 8400);
    expect(element().querySelector('[data-testid="alert-banner"]')?.textContent).toContain(
      'paid in full',
    );
  });

  it('maps a payment-exceeds-balance error onto the amount field', () => {
    billingService.list.and.returnValue(of([invoice({ balanceCents: 8400 })]));
    fixture.detectChanges();
    const failure: ApiError = {
      code: 'PAYMENT_EXCEEDS_BALANCE',
      message: 'That is more than the $84.00 balance on this invoice.',
      field: 'amountCents',
      status: 422,
    };
    billingService.recordPayment.and.returnValue(throwError(() => failure));

    component.startPayment(invoice({ balanceCents: 8400 }));
    fixture.detectChanges();
    component.submitPayment(invoice({ balanceCents: 8400 }));
    fixture.detectChanges();

    expect(element().querySelector('[data-testid="payment-server-error"]')?.textContent).toContain(
      'more than the $84.00 balance',
    );
  });

  it('does not submit an invalid payment amount', () => {
    billingService.list.and.returnValue(of([invoice({ balanceCents: 8400 })]));
    fixture.detectChanges();

    component.startPayment(invoice({ balanceCents: 8400 }));
    component.paymentForm.setValue({ amount: '0' });
    component.submitPayment(invoice({ balanceCents: 8400 }));

    expect(billingService.recordPayment).not.toHaveBeenCalled();
  });
});
