import { Component, EventEmitter, Input, Output } from '@angular/core';

import { Appointment } from '../../../../core/models';

@Component({
  selector: 'ph-appointment-card',
  templateUrl: './appointment-card.component.html',
})
export class AppointmentCardComponent {
  @Input() appointment!: Appointment;

  @Output() rescheduleRequested = new EventEmitter<Appointment>();
  @Output() cancelRequested = new EventEmitter<Appointment>();

  get canModify(): boolean {
    return this.appointment.status === 'scheduled' && this.appointment.cancellable;
  }

  get cancelBlockedReason(): string | null {
    if (this.canModify) {
      return null;
    }
    if (this.appointment.status === 'completed') {
      return 'Completed visits cannot be cancelled.';
    }
    if (this.appointment.status === 'cancelled') {
      return 'This appointment is already cancelled.';
    }
    return 'This appointment can no longer be changed.';
  }
}
