import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { Provider } from '../models/provider';

/**
 * The Provider Directory's API client. `GET /api/providers` has no search parameter, so the
 * directory's search box filters the full list client-side (see ProviderDirectoryPage);
 * inventing a query parameter here would put the frontend ahead of the frozen contract.
 */
@Injectable({ providedIn: 'root' })
export class ProviderDirectoryService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/providers';

  list(): Observable<Provider[]> {
    return this.http.get<Provider[]>(this.baseUrl);
  }

  getById(id: string): Observable<Provider> {
    return this.http.get<Provider>(`${this.baseUrl}/${encodeURIComponent(id)}`);
  }
}
