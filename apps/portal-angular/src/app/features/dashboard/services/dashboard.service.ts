import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { Appointment, Invoice, PatientProfile, Prescription } from '../../../core/models';

/**
 * Read-only summaries for the landing page. Kept separate from the per-feature services
 * (which cover the full CRUD surface for their own domain) since the dashboard only ever
 * needs a narrow, fixed slice of each one.
 */
@Injectable({ providedIn: 'root' })
export class DashboardService {
  constructor(private readonly http: HttpClient) {}

  myProfile(): Observable<PatientProfile> {
    return this.http.get<PatientProfile>('/api/patients/me');
  }

  upcomingAppointments(): Observable<Appointment[]> {
    return this.http.get<Appointment[]>('/api/appointments', { params: { scope: 'upcoming' } });
  }

  activePrescriptions(): Observable<Prescription[]> {
    return this.http.get<Prescription[]>('/api/prescriptions', { params: { status: 'active' } });
  }

  openInvoices(): Observable<Invoice[]> {
    return this.http.get<Invoice[]>('/api/billing/invoices', { params: { status: 'open' } });
  }
}
