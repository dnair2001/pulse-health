/**
 * Mirrors the frontend event shape the API's `/api/telemetry` endpoint expects
 * (see apps/mock-api/app/api/telemetry.py). Every call is fire-and-forget: this service
 * must never throw and callers must never need to await it, since the places it's invoked
 * from (interceptors, the $exceptionHandler decorator) can't usefully react to a delivery
 * failure anyway.
 */
export function TelemetryService() {
  function reportEvent(level, message, context = {}) {
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
        source: 'angularjs',
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

  function checkApiHealth() {
    fetch('/api/health')
      .then((response) => {
        if (!response.ok) {
          reportEvent('error', 'backend unreachable', { errorCode: 'HEALTH_CHECK_FAILED' });
          return;
        }
        reportEvent('info', 'backend reachable');
      })
      .catch(() => {
        reportEvent('error', 'backend unreachable', { errorCode: 'HEALTH_CHECK_FAILED' });
      });
  }

  return { reportEvent, checkApiHealth };
}
