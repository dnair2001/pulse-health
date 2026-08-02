import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { Slot, SlotQuery } from '../../../core/models';

@Injectable({ providedIn: 'root' })
export class SlotsService {
  constructor(private readonly http: HttpClient) {}

  list(query: SlotQuery = {}): Observable<Slot[]> {
    let params = new HttpParams();

    if (query.providerId) {
      params = params.set('providerId', query.providerId);
    }
    if (query.from) {
      params = params.set('from', query.from);
    }
    if (query.to) {
      params = params.set('to', query.to);
    }
    if (query.includeBooked !== undefined) {
      params = params.set('includeBooked', String(query.includeBooked));
    }

    return this.http.get<Slot[]>('/api/slots', { params });
  }
}
