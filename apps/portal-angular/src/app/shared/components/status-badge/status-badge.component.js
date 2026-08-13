import template from './status-badge.component.html';

class StatusBadgeController {
  $onInit() {
    this.status = this.status || 'scheduled';
  }

  get label() {
    switch (this.status) {
      case 'scheduled':
        return 'Scheduled';
      case 'completed':
        return 'Completed';
      case 'cancelled':
        return 'Cancelled';
      default:
        return this.status;
    }
  }

  get cssClass() {
    return `badge badge--${this.status}`;
  }
}

export const StatusBadgeComponent = {
  template,
  bindings: { status: '<' },
  controller: StatusBadgeController,
};
