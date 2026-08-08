import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';

import { ApiError, Prescription, PrescriptionStatus } from '../../../../core/models';
import { Notification, NotificationService } from '../../../../core/services/notification.service';
import { PrescriptionsService } from '../../services/prescriptions.service';

type ScopeFilter = PrescriptionStatus | '';

@Component({
  selector: 'ph-prescription-list-page',
  templateUrl: './prescription-list.page.html',
})
export class PrescriptionListPageComponent implements OnInit, OnDestroy {
  scope: ScopeFilter = '';
  prescriptions: Prescription[] = [];

  loading = false;
  error: ApiError | null = null;
  banner: Notification | null = null;

  refillingId: string | null = null;

  private readonly destroyed = new Subject<void>();

  constructor(
    private readonly prescriptionsService: PrescriptionsService,
    private readonly notifications: NotificationService,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    this.destroyed.next();
    this.destroyed.complete();
  }

  get isEmpty(): boolean {
    return !this.loading && !this.error && this.prescriptions.length === 0;
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

    this.prescriptionsService
      .list(this.scope)
      .pipe(
        finalize(() => (this.loading = false)),
        takeUntil(this.destroyed),
      )
      .subscribe({
        next: (prescriptions) => (this.prescriptions = prescriptions),
        error: (error: ApiError) => {
          this.error = error;
          this.prescriptions = [];
        },
      });
  }

  canRefill(prescription: Prescription): boolean {
    return prescription.status === 'active' && prescription.refillsRemaining > 0;
  }

  requestRefill(prescription: Prescription): void {
    this.banner = null;
    this.refillingId = prescription.id;

    this.prescriptionsService
      .requestRefill(prescription.id)
      .pipe(
        finalize(() => (this.refillingId = null)),
        takeUntil(this.destroyed),
      )
      .subscribe({
        next: () => {
          this.banner = {
            variant: 'success',
            text: `${prescription.medicationName} refill requested.`,
          };
          this.load();
        },
        error: (error: ApiError) => {
          this.banner = { variant: 'error', text: error.message };
        },
      });
  }

  dismissBanner(): void {
    this.banner = null;
  }
}
