import template from './confirm-dialog.component.html';

class ConfirmDialogController {
  $onInit() {
    this.title = this.title || 'Are you sure?';
    this.confirmLabel = this.confirmLabel || 'Confirm';
    this.cancelLabel = this.cancelLabel || 'Go back';
  }
}

export const ConfirmDialogComponent = {
  template,
  bindings: {
    open: '<',
    title: '@',
    message: '@',
    confirmLabel: '@',
    cancelLabel: '@',
    busy: '<',
    confirmed: '&',
    cancelled: '&',
  },
  controller: ConfirmDialogController,
};
