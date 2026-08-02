import { Component, Input } from '@angular/core';

import { AppointmentStatus } from '../../../core/models';

@Component({
  selector: 'ph-status-badge',
  templateUrl: './status-badge.component.html',
})
export class StatusBadgeComponent {
  @Input() status: AppointmentStatus = 'scheduled';

  get label(): string {
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

  get cssClass(): string {
    return `badge badge--${this.status}`;
  }
}
