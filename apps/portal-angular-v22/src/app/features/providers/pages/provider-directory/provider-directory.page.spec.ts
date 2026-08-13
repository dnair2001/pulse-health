import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { apiErrorInterceptor } from '../../../../core/http/api-error.interceptor';
import { provideTelemetryStub } from '../../../../testing/telemetry-stub';
import { Provider } from '../../models/provider';
import { ProviderDirectoryPage } from './provider-directory.page';

const PROVIDERS = [
  {
    id: 'prv_001',
    name: 'Dr. Alice Nguyen',
    specialty: 'Primary Care',
    credentials: 'MD',
    locationName: 'Pulse Health Downtown',
    bio: 'Bio text.',
  },
  {
    id: 'prv_002',
    name: 'Dr. Marcus Bell',
    specialty: 'Dermatology',
    credentials: 'DO',
    locationName: 'Pulse Health Riverside',
    bio: 'Bio text.',
  },
] satisfies Provider[];

describe('ProviderDirectoryPage', () => {
  let fixture: ComponentFixture<ProviderDirectoryPage>;
  let httpMock: HttpTestingController;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiErrorInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        provideTelemetryStub(),
      ],
    });

    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(ProviderDirectoryPage);
  });

  afterEach(() => {
    httpMock.verify();
  });

  function element(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function testId(id: string): HTMLElement | null {
    return element().querySelector(`[data-testid="${id}"]`);
  }

  function cardNames(): string[] {
    return Array.from(element().querySelectorAll('.provider-card .card__title')).map((node) =>
      (node.textContent ?? '').trim(),
    );
  }

  async function search(term: string): Promise<void> {
    const input = testId('provider-search') as HTMLInputElement;
    input.value = term;
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  }

  it('shows the loading state until the providers arrive', async () => {
    await fixture.whenStable();

    expect(testId('loading-spinner')?.textContent).toContain('Loading providers…');
    expect(testId('empty-state')).toBeNull();

    httpMock.expectOne('/api/providers').flush(PROVIDERS);
    await fixture.whenStable();

    expect(testId('loading-spinner')).toBeNull();
    expect(cardNames()).toEqual(['Dr. Alice Nguyen', 'Dr. Marcus Bell']);
    expect(testId('provider-card-prv_002')?.textContent).toContain('Dermatology, DO');
    expect(testId('provider-card-prv_002')?.textContent).toContain('Pulse Health Riverside');
  });

  it('filters providers by name or specialty, case-insensitively', async () => {
    await fixture.whenStable();
    httpMock.expectOne('/api/providers').flush(PROVIDERS);
    await fixture.whenStable();

    await search('dermatology');
    expect(cardNames()).toEqual(['Dr. Marcus Bell']);

    await search('NGUYEN');
    expect(cardNames()).toEqual(['Dr. Alice Nguyen']);

    await search('   ');
    expect(cardNames()).toEqual(['Dr. Alice Nguyen', 'Dr. Marcus Bell']);
  });

  it('shows the empty state when nothing matches the search', async () => {
    await fixture.whenStable();
    httpMock.expectOne('/api/providers').flush(PROVIDERS);
    await fixture.whenStable();

    await search('cardiology');

    expect(cardNames()).toEqual([]);
    expect(testId('empty-state')?.textContent).toContain('No providers match your search');
    expect(testId('empty-state')?.textContent).toContain('Try a different name or specialty.');
  });

  it('shows the empty state for an empty directory only once loading has finished', async () => {
    await fixture.whenStable();
    expect(testId('empty-state')).toBeNull();

    httpMock.expectOne('/api/providers').flush([]);
    await fixture.whenStable();

    expect(testId('empty-state')).not.toBeNull();
  });

  it('surfaces a friendly error and supports retrying', async () => {
    await fixture.whenStable();
    httpMock
      .expectOne('/api/providers')
      .flush(
        { error: { code: 'UNKNOWN', message: 'Providers are temporarily unavailable.' } },
        { status: 500, statusText: 'Server Error' },
      );
    await fixture.whenStable();

    expect(testId('alert-banner')?.textContent).toContain('Providers are temporarily unavailable.');
    expect(testId('alert-banner')?.getAttribute('role')).toBe('alert');
    expect(testId('empty-state')).toBeNull();
    expect(cardNames()).toEqual([]);

    (testId('retry') as HTMLButtonElement).click();
    await fixture.whenStable();
    httpMock.expectOne('/api/providers').flush(PROVIDERS);
    await fixture.whenStable();

    expect(testId('alert-banner')).toBeNull();
    expect(cardNames()).toEqual(['Dr. Alice Nguyen', 'Dr. Marcus Bell']);
  });

  it('navigates to a provider profile when a card is clicked', async () => {
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    await fixture.whenStable();
    httpMock.expectOne('/api/providers').flush(PROVIDERS);
    await fixture.whenStable();

    (testId('provider-card-prv_001') as HTMLButtonElement).click();

    expect(navigate).toHaveBeenCalledWith(['/providers', 'prv_001']);
  });
});
