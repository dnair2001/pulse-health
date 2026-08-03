import { request, toQueryString } from './client';
import type {
  Appointment,
  AppointmentQuery,
  Provider,
  RescheduleRequest,
  ScheduleRequest,
  Slot,
  SlotQuery,
  VisitType,
} from './types';

const APPOINTMENTS_URL = '/api/appointments';

export const api = {
  listAppointments(query: AppointmentQuery = {}): Promise<Appointment[]> {
    const search = toQueryString({
      scope: query.scope,
      providerId: query.providerId,
      status: query.status,
      visitType: query.visitType,
    });
    return request<Appointment[]>(`${APPOINTMENTS_URL}${search}`);
  },

  getAppointment(id: string): Promise<Appointment> {
    return request<Appointment>(`${APPOINTMENTS_URL}/${encodeURIComponent(id)}`);
  },

  listProviders(): Promise<Provider[]> {
    return request<Provider[]>('/api/providers');
  },

  listVisitTypes(): Promise<VisitType[]> {
    return request<VisitType[]>('/api/visit-types');
  },

  listSlots(query: SlotQuery = {}): Promise<Slot[]> {
    const search = toQueryString({
      providerId: query.providerId,
      from: query.from,
      to: query.to,
      includeBooked: query.includeBooked,
    });
    return request<Slot[]>(`/api/slots${search}`);
  },

  schedule(body: ScheduleRequest): Promise<Appointment> {
    return request<Appointment>(APPOINTMENTS_URL, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  reschedule(id: string, body: RescheduleRequest): Promise<Appointment> {
    return request<Appointment>(`${APPOINTMENTS_URL}/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },

  cancel(id: string): Promise<Appointment> {
    return request<Appointment>(`${APPOINTMENTS_URL}/${encodeURIComponent(id)}/cancel`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  },
};
