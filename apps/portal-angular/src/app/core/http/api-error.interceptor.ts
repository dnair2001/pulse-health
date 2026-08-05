import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
} from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { ApiError, ApiErrorCode, ApiErrorEnvelope } from '../models';
import { TelemetryService } from '../observability/telemetry.service';

const KNOWN_CODES: ApiErrorCode[] = [
  'VALIDATION_ERROR',
  'SLOT_IN_PAST',
  'SLOT_ALREADY_BOOKED',
  'APPOINTMENT_NOT_CANCELLABLE',
  'APPOINTMENT_NOT_RESCHEDULABLE',
  'NOT_FOUND',
];

const FALLBACK_MESSAGE = 'Something went wrong. Please try again.';

const REQUEST_ID_HEADER = 'X-Request-Id';

function isEnvelope(body: unknown): body is ApiErrorEnvelope {
  if (typeof body !== 'object' || body === null) {
    return false;
  }
  const error = (body as { error?: unknown }).error;
  return typeof error === 'object' && error !== null && 'code' in error;
}

export function toApiError(response: HttpErrorResponse): ApiError {
  if (response.status === 0) {
    return {
      code: 'NETWORK_ERROR',
      message: 'Cannot reach the Pulse Health API. Check that it is running on port 8000.',
      field: null,
      status: 0,
    };
  }

  if (isEnvelope(response.error)) {
    const { code, message, field } = response.error.error;
    return {
      code: (KNOWN_CODES as string[]).includes(code) ? (code as ApiErrorCode) : 'UNKNOWN',
      message: message || FALLBACK_MESSAGE,
      field: field ?? null,
      status: response.status,
    };
  }

  return { code: 'UNKNOWN', message: FALLBACK_MESSAGE, field: null, status: response.status };
}

/**
 * Stamps every outbound request with a fresh `X-Request-Id` and converts every HTTP
 * failure into the ApiError shape the UI renders. A fresh id per request (not one shared
 * for the app's lifetime) is what lets a single browser action be correlated to a single
 * server log line; a caller-supplied id (if a request already carries one) is respected
 * rather than overwritten, mirroring the API's own "use it if present" behaviour.
 */
@Injectable()
export class ApiErrorInterceptor implements HttpInterceptor {
  constructor(
    private readonly telemetry: TelemetryService,
    private readonly router: Router,
  ) {}

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const withRequestId = request.headers.has(REQUEST_ID_HEADER)
      ? request
      : request.clone({ setHeaders: { [REQUEST_ID_HEADER]: crypto.randomUUID() } });

    return next.handle(withRequestId).pipe(
      catchError((response: HttpErrorResponse) => {
        const apiError = toApiError(response);
        // 0 (unreachable) and 5xx are server/network-side failures worth alerting
        // on; an UNKNOWN code means we couldn't even parse the error envelope,
        // which is itself a signal something's off. Everything else (4xx with a
        // recognised code) is expected user-facing validation, hence 'warn'.
        const level =
          apiError.status === 0 || apiError.status >= 500 || apiError.code === 'UNKNOWN'
            ? 'error'
            : 'warn';
        this.telemetry.reportEvent(level, apiError.message, {
          route: this.router.url,
          requestId: withRequestId.headers.get(REQUEST_ID_HEADER) ?? undefined,
          errorCode: apiError.code,
        });
        return throwError(() => apiError);
      }),
    );
  }
}
