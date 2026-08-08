import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import {
  PatientProfile,
  UpdatePatientProfileRequest,
  VerifyIdentityResult,
} from '../../../core/models';

@Injectable({ providedIn: 'root' })
export class PatientProfileService {
  private readonly baseUrl = '/api/patients';

  constructor(private readonly http: HttpClient) {}

  getMyProfile(): Observable<PatientProfile> {
    return this.http.get<PatientProfile>(`${this.baseUrl}/me`);
  }

  updateMyProfile(payload: UpdatePatientProfileRequest): Observable<PatientProfile> {
    return this.http.patch<PatientProfile>(`${this.baseUrl}/me`, payload);
  }

  /**
   * The insurance eligibility partner's lookup endpoint only supports GET (no request
   * body), so identity for the insurance-card download is confirmed via query parameters
   * rather than a POST body.
   */
  verifyIdentity(ssn: string, dateOfBirth: string): Observable<VerifyIdentityResult> {
    return this.http.get<VerifyIdentityResult>(`${this.baseUrl}/verify`, {
      params: { ssn, dob: dateOfBirth },
    });
  }
}
