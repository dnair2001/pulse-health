import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { TelemetryService } from '../observability/telemetry.service';
import { toApiError } from './api-error';

const REQUEST_ID_HEADER = 'X-Request-Id';

function newRequestId(): string {
  // crypto.randomUUID exists only in a secure context (https, or localhost over http), so it
  // is undefined when the dev server is reached over plain http on a LAN address. A
  // correlation id is diagnostic, never authorization, so a non-crypto fallback is fine here
  // and is far better than failing the request it was supposed to help debug.
  return (
    globalThis.crypto?.randomUUID?.() ??
    `req-${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`
  );
}

/**
 * Stamps every outbound request with a fresh `X-Request-Id` and converts every HTTP failure
 * into the {@link ApiError} shape the UI renders. A fresh id per request (not one shared for
 * the app's lifetime) is what lets a single browser action be correlated to a single server
 * log line; a caller-supplied id (if a request already carries one) is respected rather than
 * overwritten, mirroring the API's own "use it if present" behaviour.
 */
export const apiErrorInterceptor: HttpInterceptorFn = (request, next) => {
  const telemetry = inject(TelemetryService);
  const router = inject(Router);

  const requestId = request.headers.get(REQUEST_ID_HEADER) ?? newRequestId();
  const stamped = request.clone({ setHeaders: { [REQUEST_ID_HEADER]: requestId } });

  return next(stamped).pipe(
    catchError((error: unknown) => {
      const apiError = toApiError(error);
      // 0 (unreachable) and 5xx are server/network-side failures worth alerting on; an
      // UNKNOWN code means we couldn't even parse the error envelope, which is itself a
      // signal something's off. Everything else (4xx with a recognised code) is expected
      // user-facing validation, hence 'warn'.
      const level =
        apiError.status === 0 || apiError.status >= 500 || apiError.code === 'UNKNOWN'
          ? 'error'
          : 'warn';

      telemetry.reportEvent(level, apiError.message, {
        route: router.url,
        requestId,
        errorCode: apiError.code,
      });

      return throwError(() => apiError);
    }),
  );
};
