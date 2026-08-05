/**
 * Frontend observability wiring: mirrors the structured JSON logging and metrics
 * apps/mock-api already has, so failures on the React side are equally visible.
 * `reportEvent` must never throw and must never be awaited by callers -- a broken
 * telemetry call must never surface to a user or block a UI action.
 */

type TelemetryLevel = 'error' | 'warn' | 'info';

interface TelemetryContext {
  route?: string;
  requestId?: string;
  errorCode?: string;
}

export function reportEvent(
  level: TelemetryLevel,
  message: string,
  context?: TelemetryContext,
): void {
  try {
    // Looked up on `console` at call time, not captured at module load, so test spies
    // installed via `vi.spyOn(console, level)` after import still take effect.
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
        source: 'react',
        level,
        message,
        route: context?.route,
        requestId: context?.requestId,
        errorCode: context?.errorCode,
      }),
    }).catch(() => {});
  } catch {
    // Telemetry is best-effort only; never let it break the caller.
  }
}

/**
 * Bounds an uncaught exception/rejection down to its `name` before it ever reaches
 * `reportEvent`. Deliberately never returns `.message`: that's free text describing
 * whatever failed, and in a patient-data app it can echo user-entered content (e.g. a
 * JSON.parse SyntaxError quoting a fragment of the bad input). `.name` is a small,
 * code-controlled value -- a built-in (TypeError, RangeError, ...) or one of our own
 * classes, never user data -- and is enough to triage by.
 */
export function errorName(value: unknown, fallback: string): string {
  return value instanceof Error ? value.name : fallback;
}

export function checkApiHealth(): void {
  try {
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
  } catch {
    // Telemetry is best-effort only; never let it break the caller.
  }
}
