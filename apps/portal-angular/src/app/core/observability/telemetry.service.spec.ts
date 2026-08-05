import { TestBed } from '@angular/core/testing';

import { TelemetryService } from './telemetry.service';

describe('TelemetryService', () => {
  let service: TelemetryService;
  let fetchSpy: jasmine.Spy;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TelemetryService);
    fetchSpy = jasmine.createSpy('fetch').and.resolveTo(new Response(null, { status: 204 }));
    window.fetch = fetchSpy as unknown as typeof window.fetch;
  });

  describe('reportEvent', () => {
    it('logs a structured entry via console.error for level "error"', () => {
      const consoleSpy = spyOn(console, 'error');

      service.reportEvent('error', 'boom', { route: '/x', requestId: 'r1', errorCode: 'E1' });

      expect(consoleSpy).toHaveBeenCalledTimes(1);
      const entry = consoleSpy.calls.mostRecent().args[0];
      expect(entry.level).toBe('error');
      expect(entry.message).toBe('boom');
      expect(entry.route).toBe('/x');
      expect(entry.requestId).toBe('r1');
      expect(entry.errorCode).toBe('E1');
      expect(typeof entry.timestamp).toBe('string');
    });

    it('logs via console.warn for level "warn"', () => {
      const consoleSpy = spyOn(console, 'warn');

      service.reportEvent('warn', 'careful');

      expect(consoleSpy).toHaveBeenCalledTimes(1);
      expect(consoleSpy.calls.mostRecent().args[0].level).toBe('warn');
    });

    it('logs via console.info for level "info"', () => {
      const consoleSpy = spyOn(console, 'info');

      service.reportEvent('info', 'all good');

      expect(consoleSpy).toHaveBeenCalledTimes(1);
      expect(consoleSpy.calls.mostRecent().args[0].level).toBe('info');
    });

    it('POSTs the event to /api/telemetry with the expected body', () => {
      spyOn(console, 'error');

      service.reportEvent('error', 'boom', { route: '/x', requestId: 'r1', errorCode: 'E1' });

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, init] = fetchSpy.calls.mostRecent().args;
      expect(url).toBe('/api/telemetry');
      expect(init.method).toBe('POST');
      expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
      expect(JSON.parse(init.body)).toEqual({
        source: 'angular',
        level: 'error',
        message: 'boom',
        route: '/x',
        requestId: 'r1',
        errorCode: 'E1',
      });
    });

    it('omits undefined optional context keys from the request body', () => {
      spyOn(console, 'info');

      service.reportEvent('info', 'all good');

      const [, init] = fetchSpy.calls.mostRecent().args;
      const body = JSON.parse(init.body);
      expect(body).toEqual({ source: 'angular', level: 'info', message: 'all good' });
    });

    it('does not throw when the fetch call rejects', () => {
      spyOn(console, 'error');
      window.fetch = jasmine.createSpy('fetch').and.rejectWith(new Error('network down'));

      expect(() => service.reportEvent('error', 'boom')).not.toThrow();
    });
  });

  describe('checkApiHealth', () => {
    it('reports info when the health check succeeds', async () => {
      const consoleSpy = spyOn(console, 'info');
      window.fetch = jasmine.createSpy('fetch').and.resolveTo(new Response(null, { status: 200 }));

      service.checkApiHealth();
      await Promise.resolve();
      await Promise.resolve();

      expect(consoleSpy).toHaveBeenCalledTimes(1);
      expect(consoleSpy.calls.mostRecent().args[0].message).toBe('backend reachable');
    });

    it('reports an error when the health check responds non-ok', async () => {
      const consoleSpy = spyOn(console, 'error');
      window.fetch = jasmine.createSpy('fetch').and.resolveTo(new Response(null, { status: 503 }));

      service.checkApiHealth();
      await Promise.resolve();
      await Promise.resolve();

      expect(consoleSpy).toHaveBeenCalledTimes(1);
      const entry = consoleSpy.calls.mostRecent().args[0];
      expect(entry.message).toBe('backend unreachable');
      expect(entry.errorCode).toBe('HEALTH_CHECK_FAILED');
    });

    it('reports an error when the health check network call fails', async () => {
      const consoleSpy = spyOn(console, 'error');
      window.fetch = jasmine.createSpy('fetch').and.rejectWith(new Error('network down'));

      service.checkApiHealth();
      await Promise.resolve();
      await Promise.resolve();

      expect(consoleSpy).toHaveBeenCalledTimes(1);
      const entry = consoleSpy.calls.mostRecent().args[0];
      expect(entry.message).toBe('backend unreachable');
      expect(entry.errorCode).toBe('HEALTH_CHECK_FAILED');
    });

    it('does not throw synchronously', () => {
      spyOn(console, 'info');
      expect(() => service.checkApiHealth()).not.toThrow();
    });
  });
});
