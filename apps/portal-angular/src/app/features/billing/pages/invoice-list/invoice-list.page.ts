import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';

import { ApiError, Invoice, InvoiceStatus } from '../../../../core/models';
import { Notification, NotificationService } from '../../../../core/services/notification.service';
import { BillingService } from '../../services/billing.service';

type ScopeFilter = InvoiceStatus | '';

@Component({
  selector: 'ph-invoice-list-page',
  templateUrl: './invoice-list.page.html',
})
export class InvoiceListPageComponent implements OnInit, OnDestroy {
  scope: ScopeFilter = '';
  invoices: Invoice[] = [];

  loading = false;
  error: ApiError | null = null;
  banner: Notification | null = null;

  payingInvoiceId: string | null = null;
  paymentForm: FormGroup;
  paying = false;

  private readonly destroyed = new Subject<void>();

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly billingService: BillingService,
    private readonly notifications: NotificationService,
  ) {
    this.paymentForm = this.formBuilder.group({
      amount: ['', [Validators.required, Validators.min(0.01)]],
    });
  }

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    this.destroyed.next();
    this.destroyed.complete();
  }

  get isEmpty(): boolean {
    return !this.loading && !this.error && this.invoices.length === 0;
  }

  selectScope(scope: ScopeFilter): void {
    if (this.scope === scope) {
      return;
    }
    this.scope = scope;
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = null;

    this.billingService
      .list(this.scope)
      .pipe(
        finalize(() => (this.loading = false)),
        takeUntil(this.destroyed),
      )
      .subscribe({
        next: (invoices) => (this.invoices = invoices),
        error: (error: ApiError) => {
          this.error = error;
          this.invoices = [];
        },
      });
  }

  startPayment(invoice: Invoice): void {
    this.payingInvoiceId = invoice.id;
    this.paymentForm.reset({ amount: (invoice.balanceCents / 100).toFixed(2) });
  }

  cancelPayment(): void {
    this.payingInvoiceId = null;
  }

  controlHasError(error: string): boolean {
    const control = this.paymentForm.get('amount');
    return Boolean(control && control.touched && control.hasError(error));
  }

  serverAmountError(): string | null {
    const message = this.paymentForm.get('amount')?.getError('server');
    return typeof message === 'string' ? message : null;
  }

  submitPayment(invoice: Invoice): void {
    if (this.paymentForm.invalid) {
      this.paymentForm.markAllAsTouched();
      return;
    }

    const amountCents = Math.round(Number(this.paymentForm.getRawValue().amount) * 100);
    this.paying = true;

    this.billingService
      .recordPayment(invoice.id, amountCents)
      .pipe(
        finalize(() => (this.paying = false)),
        takeUntil(this.destroyed),
      )
      .subscribe({
        next: (updated) => {
          this.payingInvoiceId = null;
          this.banner = {
            variant: 'success',
            text:
              updated.status === 'paid'
                ? `${invoice.serviceDescription} paid in full.`
                : `Payment applied to ${invoice.serviceDescription}.`,
          };
          this.load();
        },
        error: (error: ApiError) => {
          const control = this.paymentForm.get('amount');
          if (error.field === 'amountCents' && control) {
            control.setErrors({ server: error.message });
            control.markAsTouched();
          } else {
            this.banner = { variant: 'error', text: error.message };
            this.payingInvoiceId = null;
          }
        },
      });
  }

  dismissBanner(): void {
    this.banner = null;
  }
}
