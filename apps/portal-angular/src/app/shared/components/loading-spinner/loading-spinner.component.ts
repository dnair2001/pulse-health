import { Component, Input } from '@angular/core';

@Component({
  selector: 'ph-loading-spinner',
  templateUrl: './loading-spinner.component.html',
})
export class LoadingSpinnerComponent {
  @Input() message = 'Loading…';
}
