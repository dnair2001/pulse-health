import { Component } from '@angular/core';

import { TelemetryService } from './core/observability/telemetry.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {
  readonly patientName = 'Jordan Reyes';

  constructor(telemetry: TelemetryService) {
    telemetry.checkApiHealth();
  }
}
