import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';

import { ApiError, PatientProfile } from '../../../../core/models';
import { NotificationService } from '../../../../core/services/notification.service';
import { PatientProfileService } from '../../services/patient-profile.service';

@Component({
  selector: 'ph-patient-profile-page',
  templateUrl: './patient-profile.page.html',
})
export class PatientProfilePageComponent implements OnInit, OnDestroy {
  profile: PatientProfile | null = null;
  loading = false;
  loadError: ApiError | null = null;

  editing = false;
  form: FormGroup;
  saving = false;
  saveError: ApiError | null = null;

  verifyForm: FormGroup;
  verifying = false;
  verifyError: ApiError | null = null;
  verifyResult: { insuranceMemberId: string } | null = null;

  private readonly destroyed = new Subject<void>();

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly patientProfile: PatientProfileService,
    private readonly notifications: NotificationService,
  ) {
    this.form = this.formBuilder.group({
      email: ['', Validators.required],
      phone: ['', Validators.required],
      addressLine: ['', Validators.required],
      city: ['', Validators.required],
      state: ['', Validators.required],
      postalCode: ['', Validators.required],
      emergencyContactName: ['', Validators.required],
      emergencyContactPhone: ['', Validators.required],
    });
    this.verifyForm = this.formBuilder.group({
      ssn: ['', Validators.required],
      dob: ['', Validators.required],
    });
  }

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    this.destroyed.next();
    this.destroyed.complete();
  }

  load(): void {
    this.loading = true;
    this.loadError = null;

    this.patientProfile
      .getMyProfile()
      .pipe(
        finalize(() => (this.loading = false)),
        takeUntil(this.destroyed),
      )
      .subscribe({
        next: (profile) => {
          this.profile = profile;
          this.resetForm(profile);
        },
        error: (error: ApiError) => (this.loadError = error),
      });
  }

  startEditing(): void {
    if (this.profile) {
      this.resetForm(this.profile);
    }
    this.saveError = null;
    this.editing = true;
  }

  cancelEditing(): void {
    if (this.profile) {
      this.resetForm(this.profile);
    }
    this.saveError = null;
    this.editing = false;
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

  save(): void {
    this.saveError = null;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    this.saving = true;

    this.patientProfile
      .updateMyProfile({
        email: String(value.email ?? '').trim(),
        phone: String(value.phone ?? '').trim(),
        addressLine: String(value.addressLine ?? '').trim(),
        city: String(value.city ?? '').trim(),
        state: String(value.state ?? '').trim(),
        postalCode: String(value.postalCode ?? '').trim(),
        emergencyContactName: String(value.emergencyContactName ?? '').trim(),
        emergencyContactPhone: String(value.emergencyContactPhone ?? '').trim(),
      })
      .pipe(
        finalize(() => (this.saving = false)),
        takeUntil(this.destroyed),
      )
      .subscribe({
        next: (profile) => {
          this.profile = profile;
          this.resetForm(profile);
          this.editing = false;
          this.notifications.success('Profile updated.');
        },
        error: (error: ApiError) => this.applySaveError(error),
      });
  }

  verifyIdentityAndUnlockCard(): void {
    this.verifyError = null;
    this.verifyResult = null;

    if (this.verifyForm.invalid) {
      this.verifyForm.markAllAsTouched();
      return;
    }

    const value = this.verifyForm.getRawValue();
    this.verifying = true;

    this.patientProfile
      .verifyIdentity(String(value.ssn ?? '').trim(), String(value.dob ?? '').trim())
      .pipe(
        finalize(() => (this.verifying = false)),
        takeUntil(this.destroyed),
      )
      .subscribe({
        next: (result) => (this.verifyResult = { insuranceMemberId: result.insuranceMemberId }),
        error: (error: ApiError) => (this.verifyError = error),
      });
  }

  private resetForm(profile: PatientProfile): void {
    this.form.reset({
      email: profile.email,
      phone: profile.phone,
      addressLine: profile.addressLine,
      city: profile.city,
      state: profile.state,
      postalCode: profile.postalCode,
      emergencyContactName: profile.emergencyContactName,
      emergencyContactPhone: profile.emergencyContactPhone,
    });
  }

  private applySaveError(error: ApiError): void {
    this.saveError = error;
    const control = error.field ? this.form.get(error.field) : null;
    if (control) {
      control.setErrors({ server: error.message });
      control.markAsTouched();
    }
  }
}
