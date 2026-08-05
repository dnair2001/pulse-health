import { Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { GlobalErrorHandler } from './global-error-handler';
import { TelemetryService } from './telemetry.service';

describe('GlobalErrorHandler', () => {
  let handler: GlobalErrorHandler;
  let telemetry: jasmine.SpyObj<TelemetryService>;

  beforeEach(() => {
    telemetry = jasmine.createSpyObj<TelemetryService>('TelemetryService', ['reportEvent']);

    TestBed.configureTestingModule({
      providers: [
        GlobalErrorHandler,
        { provide: TelemetryService, useValue: telemetry },
        { provide: Router, useValue: { url: '/appointments' } },
      ],
    });

    handler = TestBed.inject(GlobalErrorHandler);
  });

  it('logs the raw error to the console', () => {
    const consoleSpy = spyOn(console, 'error');
    const error = new Error('kaboom');

    handler.handleError(error);

    expect(consoleSpy).toHaveBeenCalledWith(error);
  });

  it('reports an Error instance using its message', () => {
    spyOn(console, 'error');

    handler.handleError(new Error('kaboom'));

    expect(telemetry.reportEvent).toHaveBeenCalledWith('error', 'kaboom', {
      route: '/appointments',
      errorCode: 'UNCAUGHT_EXCEPTION',
    });
  });

  it('stringifies non-Error values defensively', () => {
    spyOn(console, 'error');

    handler.handleError('a plain string failure');

    expect(telemetry.reportEvent).toHaveBeenCalledWith(
      'error',
      'a plain string failure',
      jasmine.objectContaining({ errorCode: 'UNCAUGHT_EXCEPTION' }),
    );
  });

  it('does not throw if the Router cannot be resolved', () => {
    spyOn(console, 'error');
    const injector = TestBed.inject(Injector);
    const bareHandler = new GlobalErrorHandler({
      get: (token: unknown, notFoundValue?: unknown) => {
        if (token === Router) {
          return notFoundValue;
        }
        return injector.get(token as never);
      },
    } as Injector);

    expect(() => bareHandler.handleError(new Error('kaboom'))).not.toThrow();
    expect(telemetry.reportEvent).toHaveBeenCalledWith('error', 'kaboom', {
      route: undefined,
      errorCode: 'UNCAUGHT_EXCEPTION',
    });
  });
});
