import template from './loading-spinner.component.html';

class LoadingSpinnerController {
  $onInit() {
    this.message = this.message || 'Loading…';
  }
}

export const LoadingSpinnerComponent = {
  template,
  bindings: { message: '@' },
  controller: LoadingSpinnerController,
};
