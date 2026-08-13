import { Injectable } from '@angular/core';

export type TelemetryLevel = 'info' | 'warn' | 'error';

export interface TelemetryContext {
  route?: string;
  requestId?: string;
  errorCode?: string;
}

/**
 * Mirrors the frontend event shape the API's `/api/telemetry` endpoint expects
 * (see apps/mock-api/app/api/telemetry.py). Every call is fire-and-forget: this service
 * must never throw and callers must never need to await it, since the places it's invoked
 * from (the HTTP interceptor, the ErrorHandler) can't usefully react to a delivery failure
 * anyway. `fetch` is used rather than `HttpClient` so that reporting a failed request never
 * re-enters the interceptor that reported it.
 */
@Injectable({ providedIn: 'root' })
export class TelemetryService {
  reportEvent(level: TelemetryLevel, message: string, context: TelemetryContext = {}): void {
    // `console[level]` is resolved at call time (not cached) so that a spy installed on
    // console in a test observes the call.
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
        route: context.route,
        requestId: context.requestId,
        errorCode: context.errorCode,
      }),
    }).catch(() => {
      // Delivery failures must not surface to callers; there's nowhere useful to report a
      // failure to report a failure.
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
