import { Component, input } from '@angular/core';

@Component({
  selector: 'ph-loading-spinner',
  templateUrl: './loading-spinner.component.html',
  styleUrl: './loading-spinner.component.scss',
})
export class LoadingSpinnerComponent {
  readonly message = input('Loading…');
}
