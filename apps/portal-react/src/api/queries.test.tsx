import { QueryClientProvider } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

import {
  useAppointment,
  useAppointments,
  useCancelAppointment,
  useProviders,
  useRescheduleAppointment,
  useScheduleAppointment,
  useSlots,
  useVisitTypes,
} from './queries';
import type { Appointment, Provider, Slot, VisitType } from './types';
import { createTestQueryClient, errorResponse, jsonResponse } from '../test/helpers';

const PROVIDERS: Provider[] = [
  {
    id: 'prv_001',
    name: 'Dr Amara Okafor',
    specialty: 'Cardiology',
    locationName: 'Riverside Clinic',
    credentials: 'MD',
  },
];

const VISIT_TYPES: VisitType[] = [{ id: 'in_person', label: 'In person', durationMinutes: 30 }];

const SLOTS: Slot[] = [
  {
    id: 'slt_001',
    providerId: 'prv_001',
    startsAt: '2099-01-05T09:00:00Z',
    endsAt: '2099-01-05T09:30:00Z',
    isBooked: false,
  },
];

const APPOINTMENT: Appointment = {
  id: 'apt_001',
  providerId: 'prv_001',
  provider: {
    id: 'prv_001',
    name: 'Dr Amara Okafor',
    specialty: 'Cardiology',
    locationName: 'Riverside Clinic',
  },
  slotId: 'slt_001',
  startsAt: '2099-01-05T09:00:00Z',
  endsAt: '2099-01-05T09:30:00Z',
  status: 'scheduled',
  visitType: 'in_person',
  reason: 'Annual physical',
  cancellable: true,
  createdAt: '2098-12-01T10:00:00Z',
  updatedAt: '2098-12-01T10:00:00Z',
};

function renderQueryHook<T>(hook: () => T, queryClient: QueryClient = createTestQueryClient()) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return { ...renderHook(hook, { wrapper }), queryClient };
}

function requestedUrls(): string[] {
  return globalThis.fetchMock.mock.calls.map((call) => String((call as unknown[])[0]));
}

function lastInit(): RequestInit | undefined {
  const calls = globalThis.fetchMock.mock.calls;
  const call = calls[calls.length - 1] as unknown[];
  return call[1] as RequestInit | undefined;
}

describe('useProviders', () => {
  it('resolves the provider list', async () => {
    globalThis.fetchMock.mockResolvedValue(jsonResponse(PROVIDERS));

    const { result } = renderQueryHook(() => useProviders());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(PROVIDERS);
    expect(requestedUrls()).toEqual(['/api/providers']);
  });

  it('exposes an ApiError when the request fails', async () => {
    globalThis.fetchMock.mockResolvedValue(errorResponse(500, 'BOOM', 'Providers are unavailable.'));

    const { result } = renderQueryHook(() => useProviders());

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toEqual({
      code: 'UNKNOWN',
      message: 'Providers are unavailable.',
      field: null,
      status: 500,
    });
  });
});

describe('useVisitTypes', () => {
  it('resolves the visit type list', async () => {
    globalThis.fetchMock.mockResolvedValue(jsonResponse(VISIT_TYPES));

    const { result } = renderQueryHook(() => useVisitTypes());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(VISIT_TYPES);
    expect(requestedUrls()).toEqual(['/api/visit-types']);
  });

  it('exposes an ApiError when the request fails', async () => {
    globalThis.fetchMock.mockResolvedValue(errorResponse(404, 'NOT_FOUND', 'No visit types.'));

    const { result } = renderQueryHook(() => useVisitTypes());

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toEqual({
      code: 'NOT_FOUND',
      message: 'No visit types.',
      field: null,
      status: 404,
    });
  });
});

describe('useSlots', () => {
  it('does not fetch while the provider is undefined', async () => {
    globalThis.fetchMock.mockResolvedValue(jsonResponse(SLOTS));

    const { result } = renderQueryHook(() => useSlots({ providerId: undefined }));

    await waitFor(() => expect(result.current.fetchStatus).toBe('idle'));
    expect(result.current.isPending).toBe(true);
    expect(globalThis.fetchMock).not.toHaveBeenCalled();
  });

  it('fetches once a provider is supplied', async () => {
    globalThis.fetchMock.mockResolvedValue(jsonResponse(SLOTS));

    const { result } = renderQueryHook(() => useSlots({ providerId: 'prv_001' }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(SLOTS);
    expect(requestedUrls()).toEqual(['/api/slots?providerId=prv_001']);
  });

  it('puts the whole slot query into the URL', async () => {
    globalThis.fetchMock.mockResolvedValue(jsonResponse(SLOTS));

    const { result } = renderQueryHook(() =>
      useSlots({
        providerId: 'prv_001',
        from: '2099-01-05',
        to: '2099-01-06',
        includeBooked: false,
      }),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(requestedUrls()[0]).toBe(
      '/api/slots?providerId=prv_001&from=2099-01-05&to=2099-01-06&includeBooked=false',
    );
  });
});

describe('useAppointments', () => {
  it('requests the upcoming scope', async () => {
    globalThis.fetchMock.mockResolvedValue(jsonResponse([APPOINTMENT]));

    const { result } = renderQueryHook(() => useAppointments({ scope: 'upcoming' }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(requestedUrls()).toEqual(['/api/appointments?scope=upcoming']);
  });

  it('puts scope, status and visitType into the URL', async () => {
    globalThis.fetchMock.mockResolvedValue(jsonResponse([]));

    const { result } = renderQueryHook(() =>
      useAppointments({ scope: 'past', status: ['completed'], visitType: ['video'] }),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(requestedUrls()[0]).toBe(
      '/api/appointments?scope=past&status=completed&visitType=video',
    );
  });

  it('omits everything for an empty query', async () => {
    globalThis.fetchMock.mockResolvedValue(jsonResponse([]));

    const { result } = renderQueryHook(() => useAppointments({}));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(requestedUrls()).toEqual(['/api/appointments']);
  });
});

describe('useAppointment', () => {
  it('stays disabled when the id is undefined', async () => {
    globalThis.fetchMock.mockResolvedValue(jsonResponse(APPOINTMENT));

    const { result } = renderQueryHook(() => useAppointment(undefined));

    await waitFor(() => expect(result.current.fetchStatus).toBe('idle'));
    expect(result.current.isPending).toBe(true);
    expect(globalThis.fetchMock).not.toHaveBeenCalled();
  });

  it('fetches a single appointment by id', async () => {
    globalThis.fetchMock.mockResolvedValue(jsonResponse(APPOINTMENT));

    const { result } = renderQueryHook(() => useAppointment('apt_001'));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(APPOINTMENT);
    expect(requestedUrls()).toEqual(['/api/appointments/apt_001']);
  });
});

describe('appointment mutations', () => {
  it('useScheduleAppointment POSTs to /api/appointments', async () => {
    globalThis.fetchMock.mockResolvedValue(jsonResponse(APPOINTMENT));

    const { result } = renderQueryHook(() => useScheduleAppointment());
    result.current.mutate({
      providerId: 'prv_001',
      slotId: 'slt_001',
      visitType: 'in_person',
      reason: 'Annual physical',
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(requestedUrls()).toEqual(['/api/appointments']);
    expect(lastInit()?.method).toBe('POST');
    expect(JSON.parse(String(lastInit()?.body))).toEqual({
      providerId: 'prv_001',
      slotId: 'slt_001',
      visitType: 'in_person',
      reason: 'Annual physical',
    });
  });

  it('useRescheduleAppointment PATCHes /api/appointments/:id', async () => {
    globalThis.fetchMock.mockResolvedValue(jsonResponse(APPOINTMENT));

    const { result } = renderQueryHook(() => useRescheduleAppointment('apt_001'));
    result.current.mutate({ slotId: 'slt_009' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(requestedUrls()).toEqual(['/api/appointments/apt_001']);
    expect(lastInit()?.method).toBe('PATCH');
    expect(JSON.parse(String(lastInit()?.body))).toEqual({ slotId: 'slt_009' });
  });

  it('useCancelAppointment POSTs to /api/appointments/:id/cancel', async () => {
    globalThis.fetchMock.mockResolvedValue(jsonResponse({ ...APPOINTMENT, status: 'cancelled' }));

    const { result } = renderQueryHook(() => useCancelAppointment());
    result.current.mutate('apt_001');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(requestedUrls()).toEqual(['/api/appointments/apt_001/cancel']);
    expect(lastInit()?.method).toBe('POST');
  });

  it('invalidates the appointments, appointment and slots caches after scheduling', async () => {
    globalThis.fetchMock.mockResolvedValue(jsonResponse(APPOINTMENT));
    const queryClient = createTestQueryClient();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderQueryHook(() => useScheduleAppointment(), queryClient);
    result.current.mutate({
      providerId: 'prv_001',
      slotId: 'slt_001',
      visitType: 'in_person',
      reason: 'Annual physical',
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['appointments'] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['appointment'] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['slots'] });
  });

  it('invalidates the same caches after cancelling', async () => {
    globalThis.fetchMock.mockResolvedValue(jsonResponse({ ...APPOINTMENT, status: 'cancelled' }));
    const queryClient = createTestQueryClient();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderQueryHook(() => useCancelAppointment(), queryClient);
    result.current.mutate('apt_001');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['appointments'] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['slots'] });
  });

  it('invalidates the same caches after rescheduling', async () => {
    globalThis.fetchMock.mockResolvedValue(jsonResponse(APPOINTMENT));
    const queryClient = createTestQueryClient();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderQueryHook(() => useRescheduleAppointment('apt_001'), queryClient);
    result.current.mutate({ slotId: 'slt_009' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['appointments'] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['slots'] });
  });

  it('rejects with the parsed ApiError and invalidates nothing when the mutation fails', async () => {
    globalThis.fetchMock.mockResolvedValue(
      errorResponse(409, 'SLOT_ALREADY_BOOKED', 'That slot was just taken.', 'slotId'),
    );
    const queryClient = createTestQueryClient();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderQueryHook(() => useScheduleAppointment(), queryClient);
    await expect(
      result.current.mutateAsync({
        providerId: 'prv_001',
        slotId: 'slt_001',
        visitType: 'in_person',
        reason: 'Annual physical',
      }),
    ).rejects.toEqual({
      code: 'SLOT_ALREADY_BOOKED',
      message: 'That slot was just taken.',
      field: 'slotId',
      status: 409,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(invalidateQueries).not.toHaveBeenCalled();
  });
});
