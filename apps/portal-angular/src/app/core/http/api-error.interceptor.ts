import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
} from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { ApiError, ApiErrorCode, ApiErrorEnvelope } from '../models';

const KNOWN_CODES: ApiErrorCode[] = [
  'VALIDATION_ERROR',
  'SLOT_IN_PAST',
  'SLOT_ALREADY_BOOKED',
  'APPOINTMENT_NOT_CANCELLABLE',
  'APPOINTMENT_NOT_RESCHEDULABLE',
  'NOT_FOUND',
];

const FALLBACK_MESSAGE = 'Something went wrong. Please try again.';

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

/** Converts every HTTP failure into the ApiError shape the UI renders. */
@Injectable()
export class ApiErrorInterceptor implements HttpInterceptor {
  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    return next
      .handle(request)
      .pipe(catchError((response: HttpErrorResponse) => throwError(() => toApiError(response))));
  }
}
