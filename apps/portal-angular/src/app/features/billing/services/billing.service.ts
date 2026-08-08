import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { Invoice, InvoiceStatus } from '../../../core/models';

@Injectable({ providedIn: 'root' })
export class BillingService {
  private readonly baseUrl = '/api/billing/invoices';

  constructor(private readonly http: HttpClient) {}

  list(status?: InvoiceStatus | ''): Observable<Invoice[]> {
    let params = new HttpParams();
    if (status) {
      params = params.set('status', status);
    }
    return this.http.get<Invoice[]>(this.baseUrl, { params });
  }

  recordPayment(id: string, amountCents: number): Observable<Invoice> {
    return this.http.post<Invoice>(`${this.baseUrl}/${id}/payments`, { amountCents });
  }
}
