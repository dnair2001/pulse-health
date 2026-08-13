import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { TelemetryService } from './core/observability/telemetry.service';

@Component({
  selector: 'ph-root',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly patientName = 'Jordan Reyes';

  constructor() {
    inject(TelemetryService).checkApiHealth();
  }
}
