import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';

import { api } from './endpoints';
import type {
  ApiError,
  Appointment,
  AppointmentQuery,
  Provider,
  RescheduleRequest,
  ScheduleRequest,
  Slot,
  SlotQuery,
  VisitType,
} from './types';

/**
 * Every list key carries the full query object, so two filter combinations (a different
 * `providerId` or `scope`) can never share a cache entry. Appointment details live under
 * their own root so a mutation can invalidate them as an explicit prefix.
 */
export const queryKeys = {
  appointments: ['appointments'] as const,
  appointmentList: (query: AppointmentQuery) => ['appointments', query] as const,
  appointment: ['appointment'] as const,
  appointmentDetail: (id: string | undefined) => ['appointment', id] as const,
  providers: ['providers'] as const,
  visitTypes: ['visitTypes'] as const,
  slots: ['slots'] as const,
  slotList: (query: SlotQuery | undefined) => ['slots', query] as const,
};

/**
 * Slots are invalidated by every mutation, not just scheduling: cancelling frees a slot
 * and rescheduling swaps two, so any cached availability is stale afterwards.
 */
async function invalidateAfterMutation(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.appointments }),
    queryClient.invalidateQueries({ queryKey: queryKeys.appointment }),
    queryClient.invalidateQueries({ queryKey: queryKeys.slots }),
  ]);
}

export function useAppointments(query: AppointmentQuery = {}) {
  return useQuery<Appointment[], ApiError>({
    queryKey: queryKeys.appointmentList(query),
    queryFn: () => api.listAppointments(query),
  });
}

export function useAppointment(id: string | undefined) {
  return useQuery<Appointment, ApiError>({
    queryKey: queryKeys.appointmentDetail(id),
    queryFn: () => api.getAppointment(id ?? ''),
    enabled: id !== undefined && id !== '',
  });
}

export function useProviders() {
  return useQuery<Provider[], ApiError>({
    queryKey: queryKeys.providers,
    queryFn: () => api.listProviders(),
  });
}

export function useVisitTypes() {
  return useQuery<VisitType[], ApiError>({
    queryKey: queryKeys.visitTypes,
    queryFn: () => api.listVisitTypes(),
  });
}

export function useSlots(query: SlotQuery | undefined) {
  return useQuery<Slot[], ApiError>({
    queryKey: queryKeys.slotList(query),
    queryFn: () => api.listSlots(query ?? {}),
    enabled: query !== undefined,
  });
}

export function useScheduleAppointment() {
  const queryClient = useQueryClient();

  return useMutation<Appointment, ApiError, ScheduleRequest>({
    mutationFn: (body) => api.schedule(body),
    onSuccess: () => invalidateAfterMutation(queryClient),
  });
}

export function useRescheduleAppointment() {
  const queryClient = useQueryClient();

  return useMutation<Appointment, ApiError, { id: string } & RescheduleRequest>({
    mutationFn: ({ id, slotId }) => api.reschedule(id, { slotId }),
    onSuccess: () => invalidateAfterMutation(queryClient),
  });
}

export function useCancelAppointment() {
  const queryClient = useQueryClient();

  return useMutation<Appointment, ApiError, string>({
    mutationFn: (id) => api.cancel(id),
    onSuccess: () => invalidateAfterMutation(queryClient),
  });
}
