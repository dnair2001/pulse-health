import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ApiError } from '../../../core/http/api-error';
import { apiErrorInterceptor } from '../../../core/http/api-error.interceptor';
import { provideTelemetryStub } from '../../../testing/telemetry-stub';
import { Provider } from '../models/provider';
import { ProviderDirectoryService } from './provider-directory.service';

describe('ProviderDirectoryService', () => {
  let providerDirectory: ProviderDirectoryService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiErrorInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        provideTelemetryStub(),
      ],
    });

    providerDirectory = TestBed.inject(ProviderDirectoryService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('lists providers from /api/providers', () => {
    const providers = [
      { id: 'prv_001', name: 'Dr. Alice Nguyen', specialty: 'Primary Care' },
    ] as Provider[];

    let result: Provider[] | undefined;
    providerDirectory.list().subscribe((response) => (result = response));

    httpMock.expectOne('/api/providers').flush(providers);

    expect(result).toEqual(providers);
  });

  it('fetches a single provider by id', () => {
    const provider = {
      id: 'prv_002',
      name: 'Dr. Marcus Bell',
      specialty: 'Dermatology',
    } as Provider;

    let result: Provider | undefined;
    providerDirectory.getById('prv_002').subscribe((response) => (result = response));

    httpMock.expectOne('/api/providers/prv_002').flush(provider);

    expect(result).toEqual(provider);
  });

  it('sends a correlation id with every request', () => {
    providerDirectory.list().subscribe();

    const request = httpMock.expectOne('/api/providers');
    expect(request.request.headers.get('X-Request-Id')).toBeTruthy();
    request.flush([]);
  });

  it('still sends a correlation id where crypto.randomUUID is unavailable', () => {
    // Reproduces a non-secure context: the dev server reached over plain http on a LAN
    // address, where crypto.randomUUID is undefined.
    vi.stubGlobal('crypto', {});

    try {
      providerDirectory.list().subscribe();

      const request = httpMock.expectOne('/api/providers');
      expect(request.request.headers.get('X-Request-Id')).toMatch(/^req-/);
      request.flush([]);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('surfaces the API error envelope as a typed ApiError', () => {
    let error: ApiError | undefined;
    providerDirectory.getById('prv_999').subscribe({ error: (err: ApiError) => (error = err) });

    httpMock
      .expectOne('/api/providers/prv_999')
      .flush(
        { error: { code: 'NOT_FOUND', message: 'We could not find that provider.', field: 'id' } },
        { status: 404, statusText: 'Not Found' },
      );

    expect(error).toEqual({
      code: 'NOT_FOUND',
      message: 'We could not find that provider.',
      field: 'id',
      status: 404,
    });
  });

  it('reports an unreachable API as a network error', () => {
    let error: ApiError | undefined;
    providerDirectory.list().subscribe({ error: (err: ApiError) => (error = err) });

    httpMock.expectOne('/api/providers').error(new ProgressEvent('error'), { status: 0 });

    expect(error?.code).toBe('NETWORK_ERROR');
    expect(error?.message).toBe(
      'Cannot reach the Pulse Health API. Check that it is running on port 8000.',
    );
  });

  it('falls back to a generic message when the body is not an error envelope', () => {
    let error: ApiError | undefined;
    providerDirectory.list().subscribe({ error: (err: ApiError) => (error = err) });

    httpMock
      .expectOne('/api/providers')
      .flush('<html>502</html>', { status: 502, statusText: 'Bad Gateway' });

    expect(error).toEqual({
      code: 'UNKNOWN',
      message: 'Something went wrong. Please try again.',
      field: null,
      status: 502,
    });
  });
});
