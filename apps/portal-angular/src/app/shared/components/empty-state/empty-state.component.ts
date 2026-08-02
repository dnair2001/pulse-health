import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'ph-empty-state',
  templateUrl: './empty-state.component.html',
})
export class EmptyStateComponent {
  @Input() title = 'Nothing here yet';
  @Input() message = '';
  @Input() actionLabel: string | null = null;

  @Output() action = new EventEmitter<void>();
}
