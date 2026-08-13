import { ErrorHandler, inject, Injectable, Injector } from '@angular/core';
import { Router } from '@angular/router';

import { TelemetryService } from './telemetry.service';

/**
 * Reports every otherwise-uncaught error (template expression errors, rejected promises
 * Angular funnels through here) in addition to Angular's own default console logging.
 *
 * `Router` is resolved lazily through `Injector` rather than injected directly: an
 * `ErrorHandler` is constructed very early during bootstrap, so injecting `Router` here
 * would pull the whole router graph into that construction and can close a dependency
 * cycle. Resolving it inside `handleError`, after bootstrap has finished, avoids that.
 */
@Injectable({ providedIn: 'root' })
export class GlobalErrorHandler implements ErrorHandler {
  private readonly injector = inject(Injector);
  private readonly telemetry = inject(TelemetryService);

  handleError(error: unknown): void {
    console.error(error);

    // Deliberately never forward error.message to telemetry: it is free text describing
    // whatever failed, and in a patient-data app it can echo user-entered content (e.g. a
    // JSON.parse SyntaxError quoting a fragment of the bad input). error.name is a small,
    // code-controlled value -- a built-in (TypeError, RangeError, ...) or one of our own
    // classes, never user data -- and is enough to triage by.
    const name = error instanceof Error ? error.name : 'UnknownError';

    this.telemetry.reportEvent('error', name, {
      route: this.injector.get(Router).url,
      errorCode: 'UNCAUGHT_EXCEPTION',
    });
  }
}
