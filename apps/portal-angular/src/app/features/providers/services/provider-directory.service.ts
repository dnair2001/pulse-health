import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { Provider } from '../../../core/models';

@Injectable({ providedIn: 'root' })
export class ProviderDirectoryService {
  private readonly baseUrl = '/api/providers';

  constructor(private readonly http: HttpClient) {}

  list(): Observable<Provider[]> {
    return this.http.get<Provider[]>(this.baseUrl);
  }

  getById(id: string): Observable<Provider> {
    return this.http.get<Provider>(`${this.baseUrl}/${id}`);
  }
}
