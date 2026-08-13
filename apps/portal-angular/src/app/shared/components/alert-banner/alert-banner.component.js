import template from './alert-banner.component.html';

class AlertBannerController {
  $onInit() {
    this.variant = this.variant || 'info';
    if (this.dismissible === undefined) {
      this.dismissible = true;
    }
  }

  get cssClass() {
    return `alert alert--${this.variant}`;
  }

  get role() {
    return this.variant === 'error' ? 'alert' : 'status';
  }
}

export const AlertBannerComponent = {
  template,
  bindings: {
    variant: '@',
    message: '@',
    dismissible: '<',
    dismissed: '&',
  },
  controller: AlertBannerController,
};
