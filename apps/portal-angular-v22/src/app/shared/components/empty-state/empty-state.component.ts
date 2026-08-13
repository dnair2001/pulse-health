import { Component, input, output } from '@angular/core';

@Component({
  selector: 'ph-empty-state',
  templateUrl: './empty-state.component.html',
  styleUrl: './empty-state.component.scss',
})
export class EmptyStateComponent {
  readonly title = input('Nothing here yet');
  readonly message = input('');
  readonly actionLabel = input('');
  readonly action = output<void>();
}
