import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, merge, of } from 'rxjs';
import { catchError, filter, finalize, map, switchMap, takeUntil, tap } from 'rxjs/operators';

import { ApiError, Provider, Slot, VisitType, VisitTypeId } from '../../../../core/models';
import { NotificationService } from '../../../../core/services/notification.service';
import { trimmedRequired } from '../../../../shared/validators/trimmed-required.validator';
import { AppointmentsService } from '../../services/appointments.service';
import { ProvidersService } from '../../services/providers.service';
import { SlotsService } from '../../services/slots.service';

const REASON_MIN_LENGTH = 3;
const REASON_MAX_LENGTH = 500;

@Component({
  selector: 'ph-appointment-schedule-page',
  templateUrl: './appointment-schedule.page.html',
})
export class AppointmentSchedulePageComponent implements OnInit, OnDestroy {
  form: FormGroup;

  providers: Provider[] = [];
  visitTypes: VisitType[] = [];
  slots: Slot[] = [];

  loadingReferenceData = false;
  loadingSlots = false;
  submitting = false;
  serverError: ApiError | null = null;
  referenceError: ApiError | null = null;

  readonly reasonMaxLength = REASON_MAX_LENGTH;

  private readonly slotRefresh = new Subject<string>();
  private readonly destroyed = new Subject<void>();

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly appointmentsService: AppointmentsService,
    private readonly providersService: ProvidersService,
    private readonly slotsService: SlotsService,
    private readonly notifications: NotificationService,
    private readonly router: Router,
  ) {
    this.form = this.formBuilder.group({
      providerId: ['', Validators.required],
      slotId: ['', Validators.required],
      visitType: ['', Validators.required],
      reason: ['', [trimmedRequired(REASON_MIN_LENGTH), Validators.maxLength(REASON_MAX_LENGTH)]],
    });
  }

  ngOnInit(): void {
    this.loadReferenceData();

    const providerChanges = this.form.controls['providerId'].valueChanges.pipe(
      tap(() => {
        this.form.controls['slotId'].setValue('');
        this.slots = [];
        this.serverError = null;
      }),
      map((providerId) => String(providerId ?? '')),
    );

    merge(providerChanges, this.slotRefresh.asObservable())
      .pipe(
        filter((providerId) => providerId.length > 0),
        tap(() => (this.loadingSlots = true)),
        switchMap((providerId) =>
          this.slotsService.list({ providerId }).pipe(
            catchError((error: ApiError) => {
              this.serverError = error;
              return of([] as Slot[]);
            }),
            finalize(() => (this.loadingSlots = false)),
          ),
        ),
        takeUntil(this.destroyed),
      )
      .subscribe((slots) => (this.slots = slots));
  }

  ngOnDestroy(): void {
    this.destroyed.next();
    this.destroyed.complete();
  }

  controlHasError(name: string, error: string): boolean {
    const control = this.form.get(name);
    return Boolean(control && control.touched && control.hasError(error));
  }

  serverMessageFor(name: string): string | null {
    const control = this.form.get(name);
    const message = control?.getError('server');
    return typeof message === 'string' ? message : null;
  }

  submit(): void {
    this.serverError = null;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    this.submitting = true;

    this.appointmentsService
      .schedule({
        providerId: String(value.providerId),
        slotId: String(value.slotId),
        visitType: value.visitType as VisitTypeId,
        reason: String(value.reason ?? '').trim(),
      })
      .pipe(
        finalize(() => (this.submitting = false)),
        takeUntil(this.destroyed),
      )
      .subscribe({
        next: () => {
          this.notifications.success('Appointment scheduled.');
          void this.router.navigate(['/appointments']);
        },
        error: (error: ApiError) => this.applyServerError(error),
      });
  }

  cancel(): void {
    void this.router.navigate(['/appointments']);
  }

  private loadReferenceData(): void {
    this.loadingReferenceData = true;
    this.referenceError = null;

    this.providersService
      .list()
      .pipe(
        finalize(() => (this.loadingReferenceData = false)),
        takeUntil(this.destroyed),
      )
      .subscribe({
        next: (providers) => (this.providers = providers),
        error: (error: ApiError) => (this.referenceError = error),
      });

    this.providersService
      .visitTypes()
      .pipe(takeUntil(this.destroyed))
      .subscribe({
        next: (visitTypes) => (this.visitTypes = visitTypes),
        error: () => (this.visitTypes = []),
      });
  }

  private applyServerError(error: ApiError): void {
    this.serverError = error;

    // The chosen slot is gone or invalid, so drop it and refresh availability. This runs
    // before setErrors because clearing a control revalidates it and would drop the error.
    if (error.code === 'SLOT_ALREADY_BOOKED' || error.code === 'SLOT_IN_PAST') {
      const providerId = String(this.form.controls['providerId'].value ?? '');
      this.form.controls['slotId'].setValue('', { emitEvent: false });
      if (providerId) {
        this.slotRefresh.next(providerId);
      }
    }

    const control = error.field ? this.form.get(error.field) : null;
    if (control) {
      control.setErrors({ server: error.message });
      control.markAsTouched();
    }
  }
}
