import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { Prescription, PrescriptionStatus } from '../../../core/models';

@Injectable({ providedIn: 'root' })
export class PrescriptionsService {
  private readonly baseUrl = '/api/prescriptions';

  constructor(private readonly http: HttpClient) {}

  list(status?: PrescriptionStatus | ''): Observable<Prescription[]> {
    let params = new HttpParams();
    if (status) {
      params = params.set('status', status);
    }
    return this.http.get<Prescription[]>(this.baseUrl, { params });
  }

  requestRefill(id: string): Observable<Prescription> {
    return this.http.post<Prescription>(`${this.baseUrl}/${id}/refill-request`, {});
  }
}
