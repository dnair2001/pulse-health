import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';

import { AlertBannerComponent } from './components/alert-banner/alert-banner.component';
import { ConfirmDialogComponent } from './components/confirm-dialog/confirm-dialog.component';
import { EmptyStateComponent } from './components/empty-state/empty-state.component';
import { LoadingSpinnerComponent } from './components/loading-spinner/loading-spinner.component';
import { StatusBadgeComponent } from './components/status-badge/status-badge.component';
import { VisitTypeLabelPipe } from './pipes/visit-type-label.pipe';

const EXPORTED = [
  AlertBannerComponent,
  ConfirmDialogComponent,
  EmptyStateComponent,
  LoadingSpinnerComponent,
  StatusBadgeComponent,
  VisitTypeLabelPipe,
];

@NgModule({
  declarations: EXPORTED,
  imports: [CommonModule],
  exports: [...EXPORTED, CommonModule],
})
export class SharedModule {}
