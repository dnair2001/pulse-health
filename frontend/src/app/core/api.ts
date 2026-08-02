import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export interface Health {
  status: string;
  service: string;
  version: string;
  time: string;
}

@Injectable({ providedIn: 'root' })
export class Api {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api';

  health(): Observable<Health> {
    return this.http.get<Health>(`${this.baseUrl}/health`);
  }
}
