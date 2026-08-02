import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { isApiError } from '../../../api/client';
import { useAppointments, useCancelAppointment, useVisitTypes } from '../../../api/queries';
import type { Appointment, AppointmentQuery, AppointmentScope } from '../../../api/types';
import { useNotifications } from '../../../notifications/NotificationProvider';
import type { Notification } from '../../../notifications/NotificationProvider';
import { AlertBanner } from '../../../shared/AlertBanner';
import { ConfirmDialog } from '../../../shared/ConfirmDialog';
import { EmptyState } from '../../../shared/EmptyState';
import { LoadingSpinner } from '../../../shared/LoadingSpinner';
import { formatShortWhen } from '../../../shared/formatDateTime';
import { AppointmentCard } from '../components/AppointmentCard';
import { AppointmentFilters } from '../components/AppointmentFilters';
import type { AppointmentFiltersValue } from '../components/AppointmentFilters';

const EMPTY_FILTERS: AppointmentFiltersValue = { status: '', visitType: '' };

export function AppointmentListPage() {
  const navigate = useNavigate();
  const notifications = useNotifications();

  const [scope, setScope] = useState<AppointmentScope>('upcoming');
  const [filters, setFilters] = useState<AppointmentFiltersValue>(EMPTY_FILTERS);
  const [pendingCancel, setPendingCancel] = useState<Appointment | null>(null);

  // The banner is consumed once on mount so it survives the redirect that set it
  // but does not reappear on the next visit. Depending on `clear` rather than the
  // whole context keeps this to a single run, since `clear` is stable.
  const [banner, setBanner] = useState<Notification | null>(notifications.notification);
  const { clear } = notifications;
  useEffect(() => {
    clear();
  }, [clear]);

  const query = useMemo<AppointmentQuery>(
    () => ({
      scope,
      ...(filters.status ? { status: [filters.status] } : {}),
      ...(filters.visitType ? { visitType: [filters.visitType] } : {}),
    }),
    [scope, filters],
  );

  const visitTypes = useVisitTypes();
  const appointments = useAppointments(query);
  const cancelAppointment = useCancelAppointment();

  const list = appointments.data ?? [];
  const loading = appointments.isPending;
  const error = isApiError(appointments.error) ? appointments.error : null;
  const isEmpty = !loading && !error && list.length === 0;
  const hasActiveFilters = Boolean(filters.status || filters.visitType);

  function confirmCancel() {
    const appointment = pendingCancel;
    if (!appointment) {
      return;
    }

    cancelAppointment.mutate(appointment.id, {
      onSuccess: () => {
        setPendingCancel(null);
        setBanner({ variant: 'success', text: 'Appointment cancelled.' });
      },
      onError: (cancelError) => {
        setPendingCancel(null);
        setBanner({
          variant: 'error',
          text: isApiError(cancelError)
            ? cancelError.message
            : 'Something went wrong. Please try again.',
        });
      },
    });
  }

  return (
    <section className="page">
      <header className="page__header">
        <div>
          <h1 className="page__title">Your appointments</h1>
          <p className="page__subtitle">Review upcoming visits or look back at past care.</p>
        </div>
        <button
          type="button"
          className="button button--primary"
          onClick={() => navigate('/appointments/schedule')}
          data-testid="schedule-cta"
        >
          Schedule appointment
        </button>
      </header>

      {banner ? (
        <AlertBanner
          variant={banner.variant}
          message={banner.text}
          onDismiss={() => setBanner(null)}
        />
      ) : null}

      <nav className="tabs" role="tablist">
        <button
          type="button"
          className={scope === 'upcoming' ? 'tab tab--active' : 'tab'}
          role="tab"
          aria-selected={scope === 'upcoming'}
          onClick={() => setScope('upcoming')}
          data-testid="tab-upcoming"
        >
          Upcoming
        </button>
        <button
          type="button"
          className={scope === 'past' ? 'tab tab--active' : 'tab'}
          role="tab"
          aria-selected={scope === 'past'}
          onClick={() => setScope('past')}
          data-testid="tab-past"
        >
          Past
        </button>
      </nav>

      <AppointmentFilters
        value={filters}
        visitTypes={visitTypes.data ?? []}
        onChange={setFilters}
        onClear={() => setFilters(EMPTY_FILTERS)}
      />

      {loading ? <LoadingSpinner label="Loading your appointments…" /> : null}

      {error && !loading ? (
        <div className="stack">
          <AlertBanner variant="error" message={error.message} dismissible={false} />
          <button
            type="button"
            className="button button--ghost"
            onClick={() => void appointments.refetch()}
            data-testid="retry"
          >
            Try again
          </button>
        </div>
      ) : null}

      {isEmpty && hasActiveFilters ? (
        <EmptyState
          title="No appointments match these filters"
          message="Clear the filters to see everything in this tab."
        />
      ) : null}

      {isEmpty && !hasActiveFilters && scope === 'upcoming' ? (
        <EmptyState
          title="No upcoming appointments"
          message="Book a visit and it will show up here."
          actionLabel="Schedule appointment"
          onAction={() => navigate('/appointments/schedule')}
        />
      ) : null}

      {isEmpty && !hasActiveFilters && scope === 'past' ? (
        <EmptyState
          title="No past appointments"
          message="Completed and cancelled visits will appear here."
        />
      ) : null}

      {!loading && !error && list.length > 0 ? (
        <div className="stack">
          {list.map((appointment) => (
            <AppointmentCard
              key={appointment.id}
              appointment={appointment}
              onReschedule={(target) => navigate(`/appointments/${target.id}/reschedule`)}
              onCancel={setPendingCancel}
            />
          ))}
        </div>
      ) : null}

      <ConfirmDialog
        open={pendingCancel !== null}
        busy={cancelAppointment.isPending}
        title="Cancel this appointment?"
        message={
          pendingCancel
            ? `This will free up your ${formatShortWhen(pendingCancel.startsAt)} slot with ${pendingCancel.provider.name}.`
            : ''
        }
        confirmLabel="Yes, cancel it"
        cancelLabel="Keep appointment"
        onConfirm={confirmCancel}
        onCancel={() => setPendingCancel(null)}
      />
    </section>
  );
}
