import { HTTP_INTERCEPTORS, HttpClient } from '@angular/common/http';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ApiError } from '../models';
import { ApiErrorInterceptor } from './api-error.interceptor';

describe('ApiErrorInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [{ provide: HTTP_INTERCEPTORS, useClass: ApiErrorInterceptor, multi: true }],
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
});
