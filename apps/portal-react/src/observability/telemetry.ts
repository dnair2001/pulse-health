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
