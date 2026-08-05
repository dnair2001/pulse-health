import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { finalize, switchMap, takeUntil } from 'rxjs/operators';

import { ApiError, Appointment, Slot } from '../../../../core/models';
import { NotificationService } from '../../../../core/services/notification.service';
import { AppointmentsService } from '../../services/appointments.service';
import { SlotsService } from '../../services/slots.service';

@Component({
  selector: 'ph-appointment-reschedule-page',
  templateUrl: './appointment-reschedule.page.html',
})
export class AppointmentReschedulePageComponent implements OnInit, OnDestroy {
  form: FormGroup;

  appointment: Appointment | null = null;
  slots: Slot[] = [];

  loading = false;
  loadingSlots = false;
  submitting = false;
  loadError: ApiError | null = null;
  serverError: ApiError | null = null;

  private readonly destroyed = new Subject<void>();

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly appointmentsService: AppointmentsService,
    private readonly slotsService: SlotsService,
    private readonly notifications: NotificationService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
  ) {
    this.form = this.formBuilder.group({ slotId: ['', Validators.required] });
  }

  ngOnInit(): void {
    this.loading = true;

    this.route.paramMap
      .pipe(
        switchMap((params) => this.appointmentsService.getById(String(params.get('id')))),
        finalize(() => (this.loading = false)),
        takeUntil(this.destroyed),
      )
      .subscribe({
        next: (appointment) => {
          this.appointment = appointment;
          this.loadSlots(appointment.providerId);
        },
        error: (error: ApiError) => (this.loadError = error),
      });
  }

  ngOnDestroy(): void {
    this.destroyed.next();
    this.destroyed.complete();
  }

  get canReschedule(): boolean {
    return this.appointment !== null && this.appointment.status === 'scheduled';
  }

  submit(): void {
    this.serverError = null;

    if (!this.appointment) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting = true;
    this.appointmentsService
      .reschedule(this.appointment.id, { slotId: String(this.form.getRawValue().slotId) })
      .pipe(
        finalize(() => (this.submitting = false)),
        takeUntil(this.destroyed),
      )
      .subscribe({
        next: () => {
          this.notifications.success('Appointment rescheduled.');
          void this.router.navigate(['/appointments']);
        },
        error: (error: ApiError) => {
          this.serverError = error;
          if (error.code === 'SLOT_ALREADY_BOOKED' || error.code === 'SLOT_IN_PAST') {
            this.form.controls['slotId'].setValue('');
            if (this.appointment) {
              this.loadSlots(this.appointment.providerId);
            }
          }
        },
      });
  }

  cancel(): void {
    void this.router.navigate(['/appointments']);
  }

  private loadSlots(providerId: string): void {
    this.loadingSlots = true;

    this.slotsService
      .list({ providerId })
      .pipe(
        finalize(() => (this.loadingSlots = false)),
        takeUntil(this.destroyed),
      )
      .subscribe({
        next: (slots) => (this.slots = slots),
        error: (error: ApiError) => (this.serverError = error),
      });
  }
}
