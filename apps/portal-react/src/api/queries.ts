import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { appointmentsApi, providersApi, slotsApi, visitTypesApi } from './endpoints';
import type {
  AppointmentQuery,
  RescheduleAppointmentRequest,
  ScheduleAppointmentRequest,
  SlotQuery,
} from './types';

export const queryKeys = {
  providers: ['providers'] as const,
  visitTypes: ['visit-types'] as const,
  slots: (query: SlotQuery) => ['slots', query] as const,
  appointments: (query: AppointmentQuery) => ['appointments', query] as const,
  appointment: (id: string) => ['appointment', id] as const,
};

export function useProviders() {
  return useQuery({ queryKey: queryKeys.providers, queryFn: providersApi.list });
}

export function useVisitTypes() {
  return useQuery({ queryKey: queryKeys.visitTypes, queryFn: visitTypesApi.list });
}

/** Slots are only fetched once a provider is chosen, matching the Angular flow. */
export function useSlots(query: SlotQuery) {
  return useQuery({
    queryKey: queryKeys.slots(query),
    queryFn: () => slotsApi.list(query),
    enabled: Boolean(query.providerId),
  });
}

export function useAppointments(query: AppointmentQuery) {
  return useQuery({
    queryKey: queryKeys.appointments(query),
    queryFn: () => appointmentsApi.list(query),
  });
}

export function useAppointment(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.appointment(id ?? ''),
    queryFn: () => appointmentsApi.getById(id as string),
    enabled: Boolean(id),
  });
}

/**
 * Booking, cancelling and rescheduling all change slot availability as well as
 * the appointment list, so both caches are invalidated together.
 */
function useAppointmentMutation<TVariables, TData>(
  mutationFn: (variables: TVariables) => Promise<TData>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['appointments'] }),
        queryClient.invalidateQueries({ queryKey: ['appointment'] }),
        queryClient.invalidateQueries({ queryKey: ['slots'] }),
      ]);
    },
  });
}

export function useScheduleAppointment() {
  return useAppointmentMutation((body: ScheduleAppointmentRequest) =>
    appointmentsApi.schedule(body),
  );
}

export function useRescheduleAppointment(id: string) {
  return useAppointmentMutation((body: RescheduleAppointmentRequest) =>
    appointmentsApi.reschedule(id, body),
  );
}

export function useCancelAppointment() {
  return useAppointmentMutation((id: string) => appointmentsApi.cancel(id));
}
