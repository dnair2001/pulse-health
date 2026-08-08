import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject, forkJoin } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';

import {
  ApiError,
  Appointment,
  Invoice,
  PatientProfile,
  Prescription,
} from '../../../../core/models';
import { DashboardService } from '../../services/dashboard.service';

@Component({
  selector: 'ph-dashboard-page',
  templateUrl: './dashboard.page.html',
})
export class DashboardPageComponent implements OnInit, OnDestroy {
  loading = false;
  error: ApiError | null = null;

  profile: PatientProfile | null = null;
  nextAppointment: Appointment | null = null;
  activePrescriptions: Prescription[] = [];
  openInvoices: Invoice[] = [];

  private readonly destroyed = new Subject<void>();

  constructor(private readonly dashboard: DashboardService) {}

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    this.destroyed.next();
    this.destroyed.complete();
  }

  get refillSoonCount(): number {
    return this.activePrescriptions.filter((prescription) => prescription.refillsRemaining <= 1)
      .length;
  }

  get openBalanceCents(): number {
    return this.openInvoices.reduce((total, invoice) => total + invoice.balanceCents, 0);
  }

  get overdueInvoiceCount(): number {
    return this.openInvoices.filter((invoice) => invoice.overdue).length;
  }

  load(): void {
    this.loading = true;
    this.error = null;

    forkJoin({
      profile: this.dashboard.myProfile(),
      appointments: this.dashboard.upcomingAppointments(),
      prescriptions: this.dashboard.activePrescriptions(),
      invoices: this.dashboard.openInvoices(),
    })
      .pipe(
        finalize(() => (this.loading = false)),
        takeUntil(this.destroyed),
      )
      .subscribe({
        next: ({ profile, appointments, prescriptions, invoices }) => {
          this.profile = profile;
          this.nextAppointment = appointments[0] ?? null;
          this.activePrescriptions = prescriptions;
          this.openInvoices = invoices;
        },
        error: (error: ApiError) => (this.error = error),
      });
  }
}
