import { useEffect } from 'react';
import { waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { createTestQueryClient, jsonResponse, renderWithProviders } from '../test/helpers';
import {
  queryKeys,
  useAppointment,
  useAppointments,
  useCancelAppointment,
  useRescheduleAppointment,
  useScheduleAppointment,
  useSlots,
} from './queries';
import type { Appointment, AppointmentQuery, ScheduleRequest, SlotQuery } from './types';

const APPOINTMENT: Appointment = {
  id: 'apt_001',
  providerId: 'prv_001',
  provider: {
    id: 'prv_001',
    name: 'Dr. Alice Nguyen',
    specialty: 'Primary Care',
    locationName: 'Pulse Health Downtown',
  },
  slotId: 'slt_prv_001_20260803T0900',
  startsAt: '2026-08-03T09:00:00Z',
  endsAt: '2026-08-03T09:30:00Z',
  status: 'scheduled',
  visitType: 'in_person',
  reason: 'Annual physical',
  cancellable: true,
  createdAt: '2026-08-01T12:00:00Z',
  updatedAt: '2026-08-01T12:00:00Z',
};

const SCHEDULE_BODY: ScheduleRequest = {
  providerId: 'prv_001',
  slotId: 'slt_prv_001_20260803T0900',
  visitType: 'in_person',
  reason: 'Annual physical',
};

function AppointmentsProbe({ query }: { query: AppointmentQuery }) {
  useAppointments(query);
  return null;
}

function AppointmentProbe({ id }: { id: string | undefined }) {
  useAppointment(id);
  return null;
}

function SlotsProbe({ query }: { query: SlotQuery | undefined }) {
  useSlots(query);
  return null;
}

function ScheduleProbe() {
  const { mutate } = useScheduleAppointment();
  useEffect(() => {
    mutate(SCHEDULE_BODY);
  }, [mutate]);
  return null;
}

function RescheduleProbe() {
  const { mutate } = useRescheduleAppointment();
  useEffect(() => {
    mutate({ id: 'apt_001', slotId: 'slt_prv_001_20260803T1000' });
  }, [mutate]);
  return null;
}

function CancelProbe() {
  const { mutate } = useCancelAppointment();
  useEffect(() => {
    mutate('apt_001');
  }, [mutate]);
  return null;
}

function cacheKeys(queryClient: ReturnType<typeof createTestQueryClient>): unknown[] {
  return queryClient
    .getQueryCache()
    .getAll()
    .map((query) => query.queryKey);
}

describe('query keys', () => {
  it('gives two providers separate appointment cache entries', async () => {
    globalThis.fetchMock.mockResolvedValue(jsonResponse([]));
    const queryClient = createTestQueryClient();

    renderWithProviders(
      <>
        <AppointmentsProbe query={{ scope: 'upcoming', providerId: 'prv_001' }} />
        <AppointmentsProbe query={{ scope: 'upcoming', providerId: 'prv_002' }} />
      </>,
      { queryClient },
    );

    await waitFor(() => expect(globalThis.fetchMock).toHaveBeenCalledTimes(2));

    const urls = globalThis.fetchMock.mock.calls.map((call: unknown[]) => call[0] as string);
    expect(urls).toEqual(
      expect.arrayContaining([
        '/api/appointments?scope=upcoming&providerId=prv_001',
        '/api/appointments?scope=upcoming&providerId=prv_002',
      ]),
    );

    const keys = cacheKeys(queryClient);
    expect(keys).toHaveLength(2);
    expect(keys).toContainEqual(
      queryKeys.appointmentList({ scope: 'upcoming', providerId: 'prv_001' }),
    );
    expect(keys).toContainEqual(
      queryKeys.appointmentList({ scope: 'upcoming', providerId: 'prv_002' }),
    );
  });

  it('embeds every slot filter in the key and in the request URL', async () => {
    globalThis.fetchMock.mockResolvedValue(jsonResponse([]));
    const queryClient = createTestQueryClient();
    const monday: SlotQuery = {
      providerId: 'prv_001',
      from: '2026-08-03T00:00:00Z',
      to: '2026-08-03T23:59:59Z',
      includeBooked: false,
    };
    const tuesday: SlotQuery = { ...monday, from: '2026-08-04T00:00:00Z' };

    renderWithProviders(
      <>
        <SlotsProbe query={monday} />
        <SlotsProbe query={tuesday} />
      </>,
      { queryClient },
    );

    await waitFor(() => expect(globalThis.fetchMock).toHaveBeenCalledTimes(2));

    const urls = globalThis.fetchMock.mock.calls.map((call: unknown[]) => call[0] as string);
    expect(urls).toContain(
      '/api/slots?providerId=prv_001&from=2026-08-03T00%3A00%3A00Z&to=2026-08-03T23%3A59%3A59Z&includeBooked=false',
    );

    const keys = cacheKeys(queryClient);
    expect(keys).toHaveLength(2);
    expect(keys).toContainEqual(queryKeys.slotList(monday));
    expect(keys).toContainEqual(queryKeys.slotList(tuesday));
  });
});

describe('disabled queries', () => {
  it('does not request slots until a query is supplied', async () => {
    globalThis.fetchMock.mockResolvedValue(jsonResponse([]));

    const { unmount } = renderWithProviders(<SlotsProbe query={undefined} />);
    await Promise.resolve();
    expect(globalThis.fetchMock).not.toHaveBeenCalled();
    unmount();

    renderWithProviders(<SlotsProbe query={{ providerId: 'prv_001' }} />);
    await waitFor(() => expect(globalThis.fetchMock).toHaveBeenCalledTimes(1));
  });

  it('does not request an appointment until an id is supplied', async () => {
    globalThis.fetchMock.mockResolvedValue(jsonResponse(APPOINTMENT));

    const { unmount } = renderWithProviders(<AppointmentProbe id={undefined} />);
    await Promise.resolve();
    expect(globalThis.fetchMock).not.toHaveBeenCalled();
    unmount();

    renderWithProviders(<AppointmentProbe id="apt_001" />);
    await waitFor(() => expect(globalThis.fetchMock).toHaveBeenCalledTimes(1));
    expect(globalThis.fetchMock.mock.calls[0][0]).toBe('/api/appointments/apt_001');
  });
});

describe('mutation invalidation', () => {
  it('invalidates appointments, the appointment detail and slots after scheduling', async () => {
    globalThis.fetchMock.mockResolvedValue(jsonResponse(APPOINTMENT, 201));
    const queryClient = createTestQueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    renderWithProviders(<ScheduleProbe />, { queryClient });

    await waitFor(() => expect(invalidate).toHaveBeenCalledTimes(3));
    expect(invalidate.mock.calls.map(([filters]) => filters?.queryKey)).toEqual([
      queryKeys.appointments,
      queryKeys.appointment,
      queryKeys.slots,
    ]);
  });

  it('invalidates slots after rescheduling and after cancelling', async () => {
    for (const Probe of [RescheduleProbe, CancelProbe]) {
      globalThis.fetchMock.mockResolvedValue(jsonResponse(APPOINTMENT));
      const queryClient = createTestQueryClient();
      const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

      const { unmount } = renderWithProviders(<Probe />, { queryClient });

      await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.slots }));
      expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.appointments });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.appointment });
      unmount();
    }
  });
});
