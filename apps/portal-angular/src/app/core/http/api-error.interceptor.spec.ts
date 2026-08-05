import { HTTP_INTERCEPTORS, HttpClient } from '@angular/common/http';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { ApiError } from '../models';
import { TelemetryService } from '../observability/telemetry.service';
import { ApiErrorInterceptor } from './api-error.interceptor';

describe('ApiErrorInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let telemetry: jasmine.SpyObj<TelemetryService>;

  beforeEach(() => {
    telemetry = jasmine.createSpyObj<TelemetryService>('TelemetryService', ['reportEvent']);

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        { provide: HTTP_INTERCEPTORS, useClass: ApiErrorInterceptor, multi: true },
        { provide: TelemetryService, useValue: telemetry },
        { provide: Router, useValue: { url: '/appointments/schedule' } },
      ],
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  function captureError(status: number, body: string | object): ApiError {
    let captured: ApiError | undefined;

    http.get('/api/appointments').subscribe({ error: (error: ApiError) => (captured = error) });
    httpMock.expectOne('/api/appointments').flush(body, { status, statusText: 'Error' });

    if (!captured) {
      throw new Error('expected the interceptor to surface an ApiError');
    }
    return captured;
  }

  it('normalises the API error envelope', () => {
    const error = captureError(409, {
      error: { code: 'SLOT_ALREADY_BOOKED', message: 'That slot is taken.', field: 'slotId' },
    });

    expect(error).toEqual({
      code: 'SLOT_ALREADY_BOOKED',
      message: 'That slot is taken.',
      field: 'slotId',
      status: 409,
    });
  });

  it('falls back to UNKNOWN for unrecognised codes', () => {
    const error = captureError(500, {
      error: { code: 'KABOOM', message: 'Server exploded', field: null },
    });

    expect(error.code).toBe('UNKNOWN');
    expect(error.message).toBe('Server exploded');
  });

  it('falls back to UNKNOWN with a generic message for non-envelope bodies', () => {
    const error = captureError(502, 'gateway down');

    expect(error.code).toBe('UNKNOWN');
    expect(error.message).toBe('Something went wrong. Please try again.');
    expect(error.status).toBe(502);
  });

  it('reports a connection failure as NETWORK_ERROR', () => {
    let captured: ApiError | undefined;

    http.get('/api/appointments').subscribe({ error: (error: ApiError) => (captured = error) });
    httpMock
      .expectOne('/api/appointments')
      .error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });

    expect(captured?.code).toBe('NETWORK_ERROR');
    expect(captured?.message).toContain('Cannot reach the Pulse Health API');
  });

  const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  it('sets a well-formed X-Request-Id header on the outbound request', () => {
    http.get('/api/appointments').subscribe();

    const req = httpMock.expectOne('/api/appointments');
    const requestId = req.request.headers.get('X-Request-Id');

    expect(requestId).toMatch(UUID_PATTERN);
    req.flush([]);
  });

  it('generates a distinct id for each request rather than reusing one', () => {
    http.get('/api/appointments').subscribe();
    http.get('/api/providers').subscribe();

    const [firstReq, secondReq] = [
      httpMock.expectOne('/api/appointments'),
      httpMock.expectOne('/api/providers'),
    ];
    const firstId = firstReq.request.headers.get('X-Request-Id');
    const secondId = secondReq.request.headers.get('X-Request-Id');

    expect(firstId).toMatch(UUID_PATTERN);
    expect(secondId).toMatch(UUID_PATTERN);
    expect(firstId).not.toBe(secondId);

    firstReq.flush([]);
    secondReq.flush([]);
  });

  it('reports a network failure to telemetry as an error with the outbound request id', () => {
    let captured: ApiError | undefined;

    http.get('/api/appointments').subscribe({ error: (error: ApiError) => (captured = error) });
    const req = httpMock.expectOne('/api/appointments');
    const requestId = req.request.headers.get('X-Request-Id');
    req.error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });

    expect(captured?.code).toBe('NETWORK_ERROR');
    expect(telemetry.reportEvent).toHaveBeenCalledWith('error', captured!.message, {
      route: '/appointments/schedule',
      requestId: requestId ?? undefined,
      errorCode: 'NETWORK_ERROR',
    });
  });

  it('reports a 4xx failure to telemetry as a warn', () => {
    const error = captureError(409, {
      error: { code: 'SLOT_ALREADY_BOOKED', message: 'That slot is taken.', field: 'slotId' },
    });

    expect(telemetry.reportEvent).toHaveBeenCalledWith(
      'warn',
      'That slot is taken.',
      jasmine.objectContaining({ errorCode: 'SLOT_ALREADY_BOOKED' }),
    );
    expect(error.code).toBe('SLOT_ALREADY_BOOKED');
  });

  it('reports a 5xx failure to telemetry as an error', () => {
    captureError(500, { error: { code: 'KABOOM', message: 'Server exploded', field: null } });

    expect(telemetry.reportEvent).toHaveBeenCalledWith(
      'error',
      'Server exploded',
      jasmine.objectContaining({ errorCode: 'UNKNOWN' }),
    );
  });

  it('respects a caller-supplied X-Request-Id instead of overwriting it', () => {
    http
      .get('/api/appointments', { headers: { 'X-Request-Id': 'caller-supplied-id' } })
      .subscribe();

    const req = httpMock.expectOne('/api/appointments');

    expect(req.request.headers.get('X-Request-Id')).toBe('caller-supplied-id');
    req.flush([]);
  });
});
