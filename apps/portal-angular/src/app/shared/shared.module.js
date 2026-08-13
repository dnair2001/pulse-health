import angular from 'angular';

import { AlertBannerComponent } from './components/alert-banner/alert-banner.component';
import { ConfirmDialogComponent } from './components/confirm-dialog/confirm-dialog.component';
import { EmptyStateComponent } from './components/empty-state/empty-state.component';
import { LoadingSpinnerComponent } from './components/loading-spinner/loading-spinner.component';
import { StatusBadgeComponent } from './components/status-badge/status-badge.component';
import { titlecaseFilter } from './pipes/titlecase.filter';
import { visitTypeLabelFilter } from './pipes/visit-type-label.filter';
import { trimmedRequiredDirective } from './validators/trimmed-required.directive';

angular
  .module('portalApp.shared', [])
  .component('phAlertBanner', AlertBannerComponent)
  .component('phConfirmDialog', ConfirmDialogComponent)
  .component('phEmptyState', EmptyStateComponent)
  .component('phLoadingSpinner', LoadingSpinnerComponent)
  .component('phStatusBadge', StatusBadgeComponent)
  .filter('visitTypeLabel', visitTypeLabelFilter)
  .filter('titlecase', titlecaseFilter)
  .directive('trimmedRequired', trimmedRequiredDirective);
