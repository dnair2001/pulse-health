import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { of, throwError } from 'rxjs';

import { ApiError, PatientProfile, VerifyIdentityResult } from '../../../../core/models';
import { NotificationService } from '../../../../core/services/notification.service';
import { SharedModule } from '../../../../shared/shared.module';
import { PatientProfileService } from '../../services/patient-profile.service';
import { PatientProfilePageComponent } from './patient-profile.page';

function profile(overrides: Partial<PatientProfile> = {}): PatientProfile {
  return {
    id: 'pat_001',
    name: 'Jordan Reyes',
    dateOfBirth: '1985-06-12',
    ssnLast4: '6789',
    email: 'jordan.reyes@example.com',
    phone: '555-201-3390',
    addressLine: '482 Alder Street',
    city: 'Rivertown',
    state: 'WA',
    postalCode: '98033',
    emergencyContactName: 'Sam Reyes',
    emergencyContactPhone: '555-201-9981',
    ...overrides,
  };
}

describe('PatientProfilePageComponent', () => {
  let fixture: ComponentFixture<PatientProfilePageComponent>;
  let component: PatientProfilePageComponent;
  let patientProfile: jasmine.SpyObj<PatientProfileService>;
  let notifications: jasmine.SpyObj<NotificationService>;

  beforeEach(async () => {
    patientProfile = jasmine.createSpyObj<PatientProfileService>('PatientProfileService', [
      'getMyProfile',
      'updateMyProfile',
      'verifyIdentity',
    ]);
    notifications = jasmine.createSpyObj<NotificationService>('NotificationService', [
      'success',
      'error',
      'clear',
    ]);

    await TestBed.configureTestingModule({
      declarations: [PatientProfilePageComponent],
      imports: [SharedModule, ReactiveFormsModule],
      providers: [
        { provide: PatientProfileService, useValue: patientProfile },
        { provide: NotificationService, useValue: notifications },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PatientProfilePageComponent);
    component = fixture.componentInstance;
  });

  function element(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the loading state while the profile is in flight', () => {
    patientProfile.getMyProfile.and.returnValue(of(profile()));

    fixture.detectChanges();

    expect(patientProfile.getMyProfile).toHaveBeenCalledTimes(1);
  });

  it('renders the profile once loaded, with the SSN masked', () => {
    patientProfile.getMyProfile.and.returnValue(of(profile()));

    fixture.detectChanges();

    const profileEl = element().querySelector('[data-testid="patient-profile"]');
    expect(profileEl?.textContent).toContain('Jordan Reyes');
    expect(element().querySelector('[data-testid="profile-ssn"]')?.textContent).toContain('6789');
    expect(element().querySelector('[data-testid="profile-ssn"]')?.textContent).not.toContain(
      '231-45-6789',
    );
  });

  it('surfaces a load error instead of the profile', () => {
    const failure: ApiError = {
      code: 'NETWORK_ERROR',
      message: 'Cannot reach the Pulse Health API.',
      field: null,
      status: 0,
    };
    patientProfile.getMyProfile.and.returnValue(throwError(() => failure));

    fixture.detectChanges();

    expect(element().querySelector('[data-testid="alert-banner"]')?.textContent).toContain(
      'Cannot reach the Pulse Health API.',
    );
    expect(element().querySelector('[data-testid="patient-profile"]')).toBeNull();
  });

  it('saves edited contact details and returns to the read-only view', () => {
    patientProfile.getMyProfile.and.returnValue(of(profile()));
    fixture.detectChanges();

    element().querySelector<HTMLButtonElement>('[data-testid="edit-profile"]')?.click();
    fixture.detectChanges();

    const updated = profile({ email: 'new@example.com' });
    patientProfile.updateMyProfile.and.returnValue(of(updated));
    component.form.patchValue({ email: 'new@example.com' });
    component.save();
    fixture.detectChanges();

    expect(patientProfile.updateMyProfile).toHaveBeenCalled();
    expect(notifications.success).toHaveBeenCalledOnceWith('Profile updated.');
    expect(element().querySelector('[data-testid="save-profile"]')).toBeNull();
  });

  it('maps a field-scoped server error onto the offending control', () => {
    patientProfile.getMyProfile.and.returnValue(of(profile()));
    fixture.detectChanges();
    component.startEditing();
    fixture.detectChanges();

    const failure: ApiError = {
      code: 'VALIDATION_ERROR',
      message: 'Please enter a valid email address.',
      field: 'email',
      status: 422,
    };
    patientProfile.updateMyProfile.and.returnValue(throwError(() => failure));

    component.save();
    fixture.detectChanges();

    expect(element().querySelector('[data-testid="email-server-error"]')?.textContent).toContain(
      'Please enter a valid email address.',
    );
  });

  it('verifies identity and reveals the insurance member id', () => {
    patientProfile.getMyProfile.and.returnValue(of(profile()));
    fixture.detectChanges();

    const result: VerifyIdentityResult = { verified: true, insuranceMemberId: 'PHX-88213045' };
    patientProfile.verifyIdentity.and.returnValue(of(result));

    component.verifyForm.setValue({ ssn: '231-45-6789', dob: '1985-06-12' });
    component.verifyIdentityAndUnlockCard();
    fixture.detectChanges();

    expect(patientProfile.verifyIdentity).toHaveBeenCalledOnceWith('231-45-6789', '1985-06-12');
    expect(element().querySelector('[data-testid="insurance-member-id"]')?.textContent).toContain(
      'PHX-88213045',
    );
  });

  it('surfaces an identity verification failure', () => {
    patientProfile.getMyProfile.and.returnValue(of(profile()));
    fixture.detectChanges();

    const failure: ApiError = {
      code: 'IDENTITY_NOT_VERIFIED',
      message: 'We could not verify your identity with that information.',
      field: null,
      status: 401,
    };
    patientProfile.verifyIdentity.and.returnValue(throwError(() => failure));

    component.verifyForm.setValue({ ssn: '000-00-0000', dob: '1985-06-12' });
    component.verifyIdentityAndUnlockCard();
    fixture.detectChanges();

    expect(element().querySelector('[data-testid="alert-banner"]')?.textContent).toContain(
      'We could not verify your identity with that information.',
    );
  });
});
