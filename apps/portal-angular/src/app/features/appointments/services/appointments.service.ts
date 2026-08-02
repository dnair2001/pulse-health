import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import {
  Appointment,
  AppointmentQuery,
  RescheduleAppointmentRequest,
  ScheduleAppointmentRequest,
} from '../../../core/models';

@Injectable({ providedIn: 'root' })
export class AppointmentsService {
  private readonly baseUrl = '/api/appointments';

  constructor(private readonly http: HttpClient) {}

  list(query: AppointmentQuery = {}): Observable<Appointment[]> {
    let params = new HttpParams();

    if (query.scope) {
      params = params.set('scope', query.scope);
    }
    if (query.providerId) {
      params = params.set('providerId', query.providerId);
    }
    for (const status of query.status ?? []) {
      params = params.append('status', status);
    }
    for (const visitType of query.visitType ?? []) {
      params = params.append('visitType', visitType);
    }

    return this.http.get<Appointment[]>(this.baseUrl, { params });
  }

  getById(id: string): Observable<Appointment> {
    return this.http.get<Appointment>(`${this.baseUrl}/${id}`);
  }

  schedule(request: ScheduleAppointmentRequest): Observable<Appointment> {
    return this.http.post<Appointment>(this.baseUrl, request);
  }

  reschedule(id: string, request: RescheduleAppointmentRequest): Observable<Appointment> {
    return this.http.patch<Appointment>(`${this.baseUrl}/${id}`, request);
  }

  cancel(id: string): Observable<Appointment> {
    return this.http.post<Appointment>(`${this.baseUrl}/${id}/cancel`, {});
  }
}
