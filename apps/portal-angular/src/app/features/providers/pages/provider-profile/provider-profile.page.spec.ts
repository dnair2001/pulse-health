import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError } from 'rxjs';

import { ApiError, Provider } from '../../../../core/models';
import { SharedModule } from '../../../../shared/shared.module';
import { ProviderDirectoryService } from '../../services/provider-directory.service';
import { ProviderProfilePageComponent } from './provider-profile.page';

function provider(overrides: Partial<Provider> = {}): Provider {
  return {
    id: 'prv_002',
    name: 'Dr. Marcus Bell',
    specialty: 'Dermatology',
    locationName: 'Pulse Health Riverside',
    credentials: 'DO',
    bio: 'Board-certified dermatologist.',
    ...overrides,
  };
}

function activatedRouteStub(id: string | null): Partial<ActivatedRoute> {
  return { snapshot: { paramMap: convertToParamMap(id ? { id } : {}) } as never };
}

describe('ProviderProfilePageComponent', () => {
  let fixture: ComponentFixture<ProviderProfilePageComponent>;
  let providerDirectory: jasmine.SpyObj<ProviderDirectoryService>;

  async function setup(id: string | null): Promise<void> {
    providerDirectory = jasmine.createSpyObj<ProviderDirectoryService>('ProviderDirectoryService', [
      'getById',
    ]);

    await TestBed.configureTestingModule({
      declarations: [ProviderProfilePageComponent],
      imports: [SharedModule, RouterTestingModule],
      providers: [
        { provide: ProviderDirectoryService, useValue: providerDirectory },
        { provide: ActivatedRoute, useValue: activatedRouteStub(id) },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProviderProfilePageComponent);
  }

  function element(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the loading state while the provider is in flight', async () => {
    await setup('prv_002');
    providerDirectory.getById.and.returnValue(of(provider()));

    fixture.detectChanges();

    expect(providerDirectory.getById).toHaveBeenCalledOnceWith('prv_002');
  });

  it('renders the provider once loaded, including its bio as markup', async () => {
    await setup('prv_002');
    providerDirectory.getById.and.returnValue(of(provider({ bio: 'Line one<br>Line two' })));

    fixture.detectChanges();

    const profile = element().querySelector('[data-testid="provider-profile"]');
    expect(profile?.textContent).toContain('Dr. Marcus Bell');
    const bio = element().querySelector('[data-testid="provider-bio"]');
    expect(bio?.querySelector('br')).not.toBeNull();
  });

  it('surfaces an API error instead of the profile', async () => {
    await setup('prv_002');
    const failure: ApiError = {
      code: 'NOT_FOUND',
      message: 'We could not find that provider.',
      field: 'providerId',
      status: 404,
    };
    providerDirectory.getById.and.returnValue(throwError(() => failure));

    fixture.detectChanges();

    expect(element().querySelector('[data-testid="alert-banner"]')?.textContent).toContain(
      'We could not find that provider.',
    );
    expect(element().querySelector('[data-testid="provider-profile"]')).toBeNull();
  });

  it('redirects to the directory when no id is present in the route', async () => {
    await setup(null);
    const router = TestBed.inject(Router);
    const navigate = spyOn(router, 'navigate');

    fixture.detectChanges();

    expect(navigate).toHaveBeenCalledOnceWith(['/providers']);
    expect(providerDirectory.getById).not.toHaveBeenCalled();
  });
});
