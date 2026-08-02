import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { finalize, take, takeUntil } from 'rxjs/operators';

import {
  ApiError,
  Appointment,
  AppointmentQuery,
  AppointmentScope,
  VisitType,
} from '../../../../core/models';
import { Notification, NotificationService } from '../../../../core/services/notification.service';
import { AppointmentFilterValue } from '../../components/appointment-filters/appointment-filters.component';
import { AppointmentsService } from '../../services/appointments.service';
import { ProvidersService } from '../../services/providers.service';

@Component({
  selector: 'ph-appointment-list-page',
  templateUrl: './appointment-list.page.html',
})
export class AppointmentListPageComponent implements OnInit, OnDestroy {
  scope: AppointmentScope = 'upcoming';
  appointments: Appointment[] = [];
  visitTypes: VisitType[] = [];

  loading = false;
  error: ApiError | null = null;
  banner: Notification | null = null;

  filters: AppointmentFilterValue = { status: '', visitType: '' };

  pendingCancel: Appointment | null = null;
  cancelling = false;

  private readonly destroyed = new Subject<void>();

  constructor(
    private readonly appointmentsService: AppointmentsService,
    private readonly providersService: ProvidersService,
    private readonly notifications: NotificationService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    // Banners are consumed once so they do not reappear when returning to this route.
    this.notifications.notification$.pipe(take(1)).subscribe((notification) => {
      this.banner = notification;
    });
    this.notifications.clear();

    this.providersService
      .visitTypes()
      .pipe(takeUntil(this.destroyed))
      .subscribe({
        next: (visitTypes) => (this.visitTypes = visitTypes),
        error: () => (this.visitTypes = []),
      });

    this.load();
  }

  ngOnDestroy(): void {
    this.destroyed.next();
    this.destroyed.complete();
  }

  get isEmpty(): boolean {
    return !this.loading && !this.error && this.appointments.length === 0;
  }

  get hasActiveFilters(): boolean {
    return Boolean(this.filters.status || this.filters.visitType);
  }

  load(): void {
    this.loading = true;
    this.error = null;

    this.appointmentsService
      .list(this.buildQuery())
      .pipe(
        finalize(() => (this.loading = false)),
        takeUntil(this.destroyed)
      )
      .subscribe({
        next: (appointments) => (this.appointments = appointments),
        error: (error: ApiError) => {
          this.error = error;
          this.appointments = [];
        },
      });
  }

  selectScope(scope: AppointmentScope): void {
    if (this.scope === scope) {
      return;
    }
    this.scope = scope;
    this.load();
  }

  onFiltersChanged(filters: AppointmentFilterValue): void {
    this.filters = filters;
    this.load();
  }

  requestCancel(appointment: Appointment): void {
    this.pendingCancel = appointment;
  }

  dismissCancel(): void {
    this.pendingCancel = null;
  }

  confirmCancel(): void {
    const appointment = this.pendingCancel;
    if (!appointment) {
      return;
    }

    this.cancelling = true;
    this.appointmentsService
      .cancel(appointment.id)
      .pipe(
        finalize(() => (this.cancelling = false)),
        takeUntil(this.destroyed)
      )
      .subscribe({
        next: () => {
          this.pendingCancel = null;
          this.banner = { variant: 'success', text: 'Appointment cancelled.' };
          this.load();
        },
        error: (error: ApiError) => {
          this.pendingCancel = null;
          this.banner = { variant: 'error', text: error.message };
        },
      });
  }

  goToSchedule(): void {
    void this.router.navigate(['/appointments/schedule']);
  }

  goToReschedule(appointment: Appointment): void {
    void this.router.navigate(['/appointments', appointment.id, 'reschedule']);
  }

  dismissBanner(): void {
    this.banner = null;
  }

  private buildQuery(): AppointmentQuery {
    return {
      scope: this.scope,
      status: this.filters.status ? [this.filters.status] : undefined,
      visitType: this.filters.visitType ? [this.filters.visitType] : undefined,
    };
  }
}
