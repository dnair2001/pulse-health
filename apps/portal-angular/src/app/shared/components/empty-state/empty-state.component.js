import template from './empty-state.component.html';

class EmptyStateController {
  $onInit() {
    this.title = this.title || 'Nothing here yet';
  }
}

export const EmptyStateComponent = {
  template,
  bindings: {
    title: '@',
    message: '@',
    actionLabel: '@',
    action: '&',
  },
  controller: EmptyStateController,
};
