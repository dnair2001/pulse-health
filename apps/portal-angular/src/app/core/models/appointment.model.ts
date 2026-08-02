import { ProviderSummary } from './provider.model';
import { VisitTypeId } from './visit-type.model';

export type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled';

export type AppointmentScope = 'upcoming' | 'past';

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
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleAppointmentRequest {
  providerId: string;
  slotId: string;
  visitType: VisitTypeId;
  reason: string;
}

export interface RescheduleAppointmentRequest {
  slotId: string;
}

export interface AppointmentQuery {
  scope?: AppointmentScope;
  status?: AppointmentStatus[];
  visitType?: VisitTypeId[];
  providerId?: string;
}
