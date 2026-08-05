import { Injectable } from '@angular/core';

export interface TelemetryContext {
  route?: string;
  requestId?: string;
  errorCode?: string;
}

type TelemetryLevel = 'error' | 'warn' | 'info';

/**
 * Mirrors the frontend event shape the API's `/api/telemetry` endpoint expects
 * (see apps/mock-api/app/api/telemetry.py). Every call is fire-and-forget: this
 * service must never throw and callers must never need to await it, since the
 * places it's invoked from (interceptors, ErrorHandler) can't usefully react to
 * a delivery failure anyway.
 */
@Injectable({ providedIn: 'root' })
export class TelemetryService {
  reportEvent(level: TelemetryLevel, message: string, context?: TelemetryContext): void {
    // `console[level]` is resolved at call time (not cached) so that
    // `spyOn(console, 'error')` etc. in tests observes the call.
    console[level]({
      timestamp: new Date().toISOString(),
      level,
      message,
      ...context,
    });

    fetch('/api/telemetry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'angular',
        level,
        message,
        route: context?.route,
        requestId: context?.requestId,
        errorCode: context?.errorCode,
      }),
    }).catch(() => {
      // Delivery failures must not surface to callers; there's nowhere useful
      // to report a failure to report a failure.
    });
  }

  checkApiHealth(): void {
    fetch('/api/health')
      .then((response) => {
        if (!response.ok) {
          this.reportEvent('error', 'backend unreachable', { errorCode: 'HEALTH_CHECK_FAILED' });
          return;
        }
        this.reportEvent('info', 'backend reachable');
      })
      .catch(() => {
        this.reportEvent('error', 'backend unreachable', { errorCode: 'HEALTH_CHECK_FAILED' });
      });
  }
}
