/**
 * Mirror of `apps/portal-angular/src/app/core/models` and the frozen contract in
 * `docs/api-contract.md`. Field names are the API's camelCase wire names.
 */

export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'SLOT_IN_PAST'
  | 'SLOT_ALREADY_BOOKED'
  | 'APPOINTMENT_NOT_CANCELLABLE'
  | 'APPOINTMENT_NOT_RESCHEDULABLE'
  | 'NOT_FOUND'
  | 'NETWORK_ERROR'
  | 'UNKNOWN';

/** Normalised form of the API's `{"error": {...}}` envelope, plus the HTTP status. */
export interface ApiError {
  code: ApiErrorCode;
  message: string;
  field: string | null;
  status: number;
}

export interface ApiErrorEnvelope {
  error: {
    code: string;
    message: string;
    field: string | null;
  };
}

export type VisitTypeId = 'in_person' | 'video' | 'phone';

export interface VisitType {
  id: VisitTypeId;
  label: string;
  durationMinutes: number;
}

interface ProviderSummary {
  id: string;
  name: string;
  specialty: string;
  locationName: string;
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

export interface SlotQuery {
  providerId?: string;
  from?: string;
  to?: string;
  includeBooked?: boolean;
}

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

export interface AppointmentQuery {
  scope?: AppointmentScope;
  status?: AppointmentStatus[];
  visitType?: VisitTypeId[];
  providerId?: string;
}

/** Body of `POST /api/appointments`. */
export interface ScheduleRequest {
  providerId: string;
  slotId: string;
  visitType: VisitTypeId;
  reason: string;
}

/** Body of `PATCH /api/appointments/{id}`. */
export interface RescheduleRequest {
  slotId: string;
}
