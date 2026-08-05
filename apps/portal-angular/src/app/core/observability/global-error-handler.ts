import { ErrorHandler, Injectable, Injector } from '@angular/core';
import { Router } from '@angular/router';

import { TelemetryService } from './telemetry.service';

/**
 * Catches anything that escapes every other error path (component render errors,
 * unhandled promise rejections funnelled through Zone.js, etc.) and reports it.
 *
 * Angular constructs `ErrorHandler` during bootstrap, before the router (and
 * potentially before other services in the injector graph) are guaranteed to be
 * ready, so constructor-injecting `Router` here is unreliable. Injecting the
 * `Injector` itself and resolving dependencies lazily inside `handleError` is the
 * standard workaround: by the time an error actually occurs, the app has finished
 * bootstrapping and everything is safe to resolve.
 */
@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  constructor(private readonly injector: Injector) {}

  handleError(error: unknown): void {
    console.error(error);

    const message = error instanceof Error ? error.message : String(error);
    const telemetry = this.injector.get(TelemetryService);
    const route = this.injector.get(Router, null)?.url;

    telemetry.reportEvent('error', message, {
      route: route ?? undefined,
      errorCode: 'UNCAUGHT_EXCEPTION',
    });
  }
}
