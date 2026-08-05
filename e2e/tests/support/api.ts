import type { APIRequestContext } from '@playwright/test';

export type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled';
export type VisitTypeId = 'in_person' | 'video' | 'phone';

export interface ProviderSummary {
  id: string;
  name: string;
  specialty: string;
  locationName: string;
}

export interface Appointment {
  id: string;
  providerId: string;
  provider: ProviderSummary;
  slotId: string;
  startsAt: string;
  endsAt: string;
  status: AppointmentStatus;
  visitType: VisitTypeId;
  reason: string;
  cancellable: boolean;
}

export interface Provider extends ProviderSummary {
  credentials: string;
}

export interface Slot {
  id: string;
  providerId: string;
  startsAt: string;
  endsAt: string;
  isBooked: boolean;
}

export interface VisitType {
  id: VisitTypeId;
  label: string;
  durationMinutes: number;
}

export interface ApiErrorEnvelope {
  error: { code: string; message: string; field: string | null };
}

/**
 * Thin wrapper over the frozen contract in `docs/api-contract.md`. The suite reads expectations
 * from here instead of hardcoding dates, because seed data is generated relative to now.
 */
export class Api {
  constructor(private readonly request: APIRequestContext) {}

  private async json<T>(url: string): Promise<T> {
    const response = await this.request.get(url);
    if (!response.ok()) {
      throw new Error(`GET ${url} failed with ${response.status()}: ${await response.text()}`);
    }
    return (await response.json()) as T;
  }

  async reset(): Promise<void> {
    const response = await this.request.post('/api/dev/reset');
    if (!response.ok()) {
      throw new Error(`POST /api/dev/reset failed with ${response.status()}`);
    }
  }

  /** Omit `scope` for everything: the contract accepts `upcoming` or `past` only. */
  appointments(scope?: 'upcoming' | 'past'): Promise<Appointment[]> {
    return this.json<Appointment[]>(
      scope ? `/api/appointments?scope=${scope}` : '/api/appointments',
    );
  }

  providers(): Promise<Provider[]> {
    return this.json<Provider[]>('/api/providers');
  }

  visitTypes(): Promise<VisitType[]> {
    return this.json<VisitType[]>('/api/visit-types');
  }

  slots(providerId: string): Promise<Slot[]> {
    return this.json<Slot[]>(`/api/slots?providerId=${encodeURIComponent(providerId)}`);
  }

  /** Books directly against the API, standing in for a second patient racing the browser. */
  async schedule(body: {
    providerId: string;
    slotId: string;
    visitType: VisitTypeId;
    reason: string;
  }): Promise<Appointment> {
    const response = await this.request.post('/api/appointments', { data: body });
    if (!response.ok()) {
      throw new Error(`POST /api/appointments failed with ${response.status()}`);
    }
    return (await response.json()) as Appointment;
  }
}
