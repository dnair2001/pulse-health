import { request, toQueryString } from './client';
import type {
  Appointment,
  AppointmentQuery,
  Provider,
  RescheduleAppointmentRequest,
  ScheduleAppointmentRequest,
  Slot,
  SlotQuery,
  VisitType,
} from './types';

export const providersApi = {
  list: () => request<Provider[]>('/api/providers'),
};

export const visitTypesApi = {
  list: () => request<VisitType[]>('/api/visit-types'),
};

export const slotsApi = {
  list: (query: SlotQuery = {}) =>
    request<Slot[]>(
      `/api/slots${toQueryString({
        providerId: query.providerId,
        from: query.from,
        to: query.to,
        includeBooked: query.includeBooked,
      })}`,
    ),
};

export const appointmentsApi = {
  list: (query: AppointmentQuery = {}) =>
    request<Appointment[]>(
      `/api/appointments${toQueryString({
        scope: query.scope,
        providerId: query.providerId,
        status: query.status,
        visitType: query.visitType,
      })}`,
    ),

  getById: (id: string) => request<Appointment>(`/api/appointments/${id}`),

  schedule: (body: ScheduleAppointmentRequest) =>
    request<Appointment>('/api/appointments', { method: 'POST', body: JSON.stringify(body) }),

  reschedule: (id: string, body: RescheduleAppointmentRequest) =>
    request<Appointment>(`/api/appointments/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  cancel: (id: string) =>
    request<Appointment>(`/api/appointments/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),
};
