import { Component, EventEmitter, Input, Output } from '@angular/core';

export type AlertVariant = 'success' | 'error' | 'info';

@Component({
  selector: 'ph-alert-banner',
  templateUrl: './alert-banner.component.html',
})
export class AlertBannerComponent {
  @Input() variant: AlertVariant = 'info';
  @Input() message = '';
  @Input() dismissible = true;

  @Output() dismissed = new EventEmitter<void>();

  get cssClass(): string {
    return `alert alert--${this.variant}`;
  }

  get role(): string {
    return this.variant === 'error' ? 'alert' : 'status';
  }
}
