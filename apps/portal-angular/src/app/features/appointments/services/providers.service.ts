import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { Provider, VisitType } from '../../../core/models';

@Injectable({ providedIn: 'root' })
export class ProvidersService {
  constructor(private readonly http: HttpClient) {}

  list(): Observable<Provider[]> {
    return this.http.get<Provider[]>('/api/providers');
  }

  visitTypes(): Observable<VisitType[]> {
    return this.http.get<VisitType[]>('/api/visit-types');
  }
}
