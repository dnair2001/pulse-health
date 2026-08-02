import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { Home } from './home';

describe('Home', () => {
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Home],
      providers: [provideHttpClient(), provideHttpClientTesting()]
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('renders the status returned by the health endpoint', async () => {
    const fixture = TestBed.createComponent(Home);

    httpMock.expectOne('/api/health').flush({
      status: 'ok',
      service: 'webapp-api',
      version: '0.1.0',
      time: '2026-01-01T00:00:00Z'
    });
    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Backend ok');
  });

  it('shows an error message when the backend is unreachable', async () => {
    const fixture = TestBed.createComponent(Home);

    httpMock.expectOne('/api/health').error(new ProgressEvent('error'), { status: 503 });
    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Backend unreachable');
  });
});
