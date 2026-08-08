import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing';
import { Router } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';

import { ApiError, Provider } from '../../../../core/models';
import { SharedModule } from '../../../../shared/shared.module';
import { ProviderDirectoryService } from '../../services/provider-directory.service';
import { ProviderDirectoryPageComponent } from './provider-directory.page';

function provider(overrides: Partial<Provider> = {}): Provider {
  return {
    id: 'prv_001',
    name: 'Dr. Alice Nguyen',
    specialty: 'Primary Care',
    locationName: 'Pulse Health Downtown',
    credentials: 'MD',
    bio: 'Dr. Nguyen has practiced primary care for over a decade.',
    ...overrides,
  };
}

describe('ProviderDirectoryPageComponent', () => {
  let fixture: ComponentFixture<ProviderDirectoryPageComponent>;
  let component: ProviderDirectoryPageComponent;
  let providerDirectory: jasmine.SpyObj<ProviderDirectoryService>;
  let router: Router;

  beforeEach(async () => {
    providerDirectory = jasmine.createSpyObj<ProviderDirectoryService>('ProviderDirectoryService', [
      'list',
      'getById',
    ]);

    await TestBed.configureTestingModule({
      declarations: [ProviderDirectoryPageComponent],
      imports: [SharedModule, FormsModule, RouterTestingModule],
      providers: [{ provide: ProviderDirectoryService, useValue: providerDirectory }],
    }).compileComponents();

    fixture = TestBed.createComponent(ProviderDirectoryPageComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
  });

  function element(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the loading state while providers are in flight', () => {
    providerDirectory.list.and.returnValue(new Subject<Provider[]>());

    fixture.detectChanges();

    expect(element().querySelector('[data-testid="loading-spinner"]')).not.toBeNull();
  });

  it('renders a card per provider once loaded', () => {
    providerDirectory.list.and.returnValue(
      of([provider(), provider({ id: 'prv_002', name: 'Dr. Marcus Bell' })]),
    );

    fixture.detectChanges();

    expect(element().querySelectorAll('.provider-card').length).toBe(2);
    expect(element().querySelector('[data-testid="provider-card-prv_001"]')?.textContent).toContain(
      'Dr. Alice Nguyen',
    );
  });

  it('filters by name or specialty as the search term changes', () => {
    providerDirectory.list.and.returnValue(
      of([provider(), provider({ id: 'prv_002', name: 'Dr. Marcus Bell', specialty: 'Dermatology' })]),
    );

    fixture.detectChanges();
    component.search = 'dermatology';
    fixture.detectChanges();

    expect(element().querySelectorAll('.provider-card').length).toBe(1);
    expect(element().querySelector('[data-testid="provider-card-prv_002"]')).not.toBeNull();
  });

  it('shows an empty state when the search matches nothing', () => {
    providerDirectory.list.and.returnValue(of([provider()]));

    fixture.detectChanges();
    component.search = 'no such specialty';
    fixture.detectChanges();

    expect(element().querySelector('[data-testid="empty-state"]')?.textContent).toContain(
      'No providers match your search',
    );
  });

  it('surfaces API errors and retries on demand', () => {
    const failure: ApiError = {
      code: 'NETWORK_ERROR',
      message: 'Cannot reach the Pulse Health API.',
      field: null,
      status: 0,
    };
    providerDirectory.list.and.returnValue(throwError(() => failure));

    fixture.detectChanges();

    expect(element().querySelector('[data-testid="alert-banner"]')?.textContent).toContain(
      'Cannot reach the Pulse Health API.',
    );

    providerDirectory.list.and.returnValue(of([provider()]));
    element().querySelector<HTMLButtonElement>('[data-testid="retry"]')?.click();
    fixture.detectChanges();

    expect(element().querySelectorAll('.provider-card').length).toBe(1);
  });

  it('navigates to the profile page when a provider card is clicked', () => {
    providerDirectory.list.and.returnValue(of([provider()]));
    const navigate = spyOn(router, 'navigate');

    fixture.detectChanges();
    element().querySelector<HTMLButtonElement>('[data-testid="provider-card-prv_001"]')?.click();

    expect(navigate).toHaveBeenCalledOnceWith(['/providers', 'prv_001']);
  });
});
