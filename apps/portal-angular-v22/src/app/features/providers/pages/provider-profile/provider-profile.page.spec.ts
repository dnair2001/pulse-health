import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { apiErrorInterceptor } from '../../../../core/http/api-error.interceptor';
import { provideTelemetryStub } from '../../../../testing/telemetry-stub';
import { Provider } from '../../models/provider';
import { ProviderProfilePage } from './provider-profile.page';

const PROVIDER = {
  id: 'prv_002',
  name: 'Dr. Marcus Bell',
  specialty: 'Dermatology',
  credentials: 'DO',
  locationName: 'Pulse Health Riverside',
  bio: 'Board-certified dermatologist.',
} satisfies Provider;

describe('ProviderProfilePage', () => {
  let fixture: ComponentFixture<ProviderProfilePage>;
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
    fixture = TestBed.createComponent(ProviderProfilePage);
  });

  afterEach(() => {
    httpMock.verify();
  });

  function testId(id: string): HTMLElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector(`[data-testid="${id}"]`);
  }

  async function loadRoute(id: string): Promise<void> {
    fixture.componentRef.setInput('id', id);
    await fixture.whenStable();
  }

  it('shows the loading state, then the provider named by the route id', async () => {
    await loadRoute('prv_002');

    expect(testId('loading-spinner')?.textContent).toContain('Loading provider…');

    httpMock.expectOne('/api/providers/prv_002').flush(PROVIDER);
    await fixture.whenStable();

    expect(testId('loading-spinner')).toBeNull();
    const profile = testId('provider-profile');
    expect(profile?.textContent).toContain('Dr. Marcus Bell');
    expect(profile?.textContent).toContain('Dermatology, DO');
    expect(profile?.textContent).toContain('Pulse Health Riverside');
    expect(testId('provider-bio')?.textContent).toContain('Board-certified dermatologist.');
  });

  it('redirects to the directory when the route has no id', async () => {
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    await fixture.whenStable();

    expect(navigate).toHaveBeenCalledWith(['/providers']);
  });

  it('surfaces the not-found error for an unknown provider id', async () => {
    await loadRoute('prv_999');

    httpMock
      .expectOne('/api/providers/prv_999')
      .flush(
        { error: { code: 'NOT_FOUND', message: 'We could not find that provider.', field: 'id' } },
        { status: 404, statusText: 'Not Found' },
      );
    await fixture.whenStable();

    expect(testId('alert-banner')?.textContent).toContain('We could not find that provider.');
    expect(testId('alert-banner')?.getAttribute('role')).toBe('alert');
    expect(testId('provider-profile')).toBeNull();
    // The page frame (and the way back) stays on screen instead of going blank.
    expect(testId('back')).not.toBeNull();
  });

  it('surfaces a server error without dropping the page frame', async () => {
    await loadRoute('prv_002');

    httpMock
      .expectOne('/api/providers/prv_002')
      .flush(
        { error: { code: 'UNKNOWN', message: 'Providers are temporarily unavailable.' } },
        { status: 500, statusText: 'Server Error' },
      );
    await fixture.whenStable();

    expect(testId('alert-banner')?.textContent).toContain('Providers are temporarily unavailable.');
    expect(testId('provider-profile')).toBeNull();
  });

  it('goes back to the directory route', async () => {
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    await loadRoute('prv_002');
    httpMock.expectOne('/api/providers/prv_002').flush(PROVIDER);
    await fixture.whenStable();

    (testId('back') as HTMLButtonElement).click();

    expect(navigate).toHaveBeenCalledWith(['/providers']);
  });

  // Regression test for the stored-XSS finding the pre-AngularJS version of this app shipped
  // (bio rendered via [innerHTML] bound to a DomSanitizer.bypassSecurityTrustHtml value):
  // rendering a bio that carries an onerror handler must strip the handler before it reaches
  // the DOM, so it can never run.
  it('sanitizes an unsafe bio instead of trusting it outright', async () => {
    await loadRoute('prv_002');

    httpMock.expectOne('/api/providers/prv_002').flush({
      ...PROVIDER,
      bio: 'Safe text. <b>Bold.</b> <img src="x" onerror="window.__pwned = true">',
    } satisfies Provider);
    await fixture.whenStable();

    const bio = testId('provider-bio');
    expect(bio?.textContent).toContain('Safe text.');
    expect(bio?.innerHTML).toContain('<b>Bold.</b>');
    expect(bio?.innerHTML).not.toContain('onerror');
    expect((window as unknown as { __pwned?: boolean }).__pwned).toBeUndefined();
  });

  // A bio must not be able to make a patient's browser fetch an attacker-chosen image
  // (tracking, content spoofing). See toBioHtml, and CVE-2024-8372 / CVE-2024-8373 for the
  // sanitizer gap this closes.
  it('renders no external image reference from a bio', async () => {
    await loadRoute('prv_002');

    httpMock.expectOne('/api/providers/prv_002').flush({
      ...PROVIDER,
      bio:
        'Board-certified. <img src="https://attacker.example/p.png" ' +
        'srcset="https://attacker.example/2x.png 2x">' +
        '<picture><source srcset="https://attacker.example/s.png"></picture> Riverside.',
    } satisfies Provider);
    await fixture.whenStable();

    const bio = testId('provider-bio');
    expect(bio?.textContent).toContain('Board-certified.');
    expect(bio?.textContent).toContain('Riverside.');
    expect(bio?.querySelectorAll('img, picture, source')).toHaveLength(0);
    expect(bio?.innerHTML).not.toContain('attacker.example');
  });
});
