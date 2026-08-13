import { Component, computed, input, output } from '@angular/core';

export type AlertVariant = 'success' | 'error' | 'info';

@Component({
  selector: 'ph-alert-banner',
  templateUrl: './alert-banner.component.html',
  styleUrl: './alert-banner.component.scss',
})
export class AlertBannerComponent {
  readonly variant = input<AlertVariant>('info');
  readonly message = input('');
  readonly dismissible = input(true);
  readonly dismissed = output<void>();

  readonly cssClass = computed(() => `alert alert--${this.variant()}`);
  readonly role = computed(() => (this.variant() === 'error' ? 'alert' : 'status'));
}
