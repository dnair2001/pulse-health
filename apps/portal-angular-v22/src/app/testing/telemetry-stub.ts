import { Provider } from '@angular/core';

import { TelemetryService } from '../core/observability/telemetry.service';

/**
 * Keeps specs off the real TelemetryService, which logs to the console and posts to
 * `/api/telemetry` with `fetch` -- neither of which a unit test should do, and neither of
 * which the HTTP testing backend can intercept.
 */
export function provideTelemetryStub(): Provider {
  return {
    provide: TelemetryService,
    useValue: {
      reportEvent: () => undefined,
      checkApiHealth: () => undefined,
    } satisfies Pick<TelemetryService, 'reportEvent' | 'checkApiHealth'>,
  };
}
