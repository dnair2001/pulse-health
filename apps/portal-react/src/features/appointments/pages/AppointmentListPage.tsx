import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAppointments, useCancelAppointment, useVisitTypes } from '../../../api/queries';
import type { Appointment, AppointmentQuery, AppointmentScope } from '../../../api/types';
import type { Notification } from '../../../notifications/NotificationProvider';
import { useNotifications } from '../../../notifications/NotificationProvider';
import { AlertBanner } from '../../../shared/AlertBanner';
import { ConfirmDialog } from '../../../shared/ConfirmDialog';
import { EmptyState } from '../../../shared/EmptyState';
import { LoadingSpinner } from '../../../shared/LoadingSpinner';
import { formatShortDateTime } from '../../../shared/formatDateTime';
import { AppointmentCard } from '../components/AppointmentCard';
import { AppointmentFilters } from '../components/AppointmentFilters';
import type { AppointmentFilterValue } from '../components/AppointmentFilters';

const NO_FILTERS: AppointmentFilterValue = { status: '', visitType: '' };

function buildQuery(scope: AppointmentScope, filters: AppointmentFilterValue): AppointmentQuery {
  return {
    scope,
    status: filters.status ? [filters.status] : undefined,
    visitType: filters.visitType ? [filters.visitType] : undefined,
  };
}

export function AppointmentListPage() {
  const navigate = useNavigate();
  const { notification, clear } = useNotifications();

  const [scope, setScope] = useState<AppointmentScope>('upcoming');
  const [filters, setFilters] = useState<AppointmentFilterValue>(NO_FILTERS);
  const [pendingCancel, setPendingCancel] = useState<Appointment | null>(null);

  // Mirrors the Angular `take(1)` + `clear()`: the banner is captured once at mount so it
  // cannot reappear when the patient navigates back to this route.
  const [banner, setBanner] = useState<Notification | null>(() => notification);
  useEffect(() => {
    clear();
  }, [clear]);

  const visitTypesQuery = useVisitTypes();
  const appointmentsQuery = useAppointments(buildQuery(scope, filters));
  const cancelAppointment = useCancelAppointment();

  const visitTypes = visitTypesQuery.data ?? [];
  const loading = appointmentsQuery.isFetching;
  const error = appointmentsQuery.error;
  const appointments = error ? [] : (appointmentsQuery.data ?? []);

  const isEmpty = !loading && !error && appointments.length === 0;
  const hasActiveFilters = Boolean(filters.status || filters.visitType);

  const goToSchedule = () => {
    void navigate('/appointments/schedule');
  };

  const goToReschedule = (appointment: Appointment) => {
    void navigate(`/appointments/${appointment.id}/reschedule`);
  };

  const selectScope = (next: AppointmentScope) => {
    setScope((current) => (current === next ? current : next));
  };

  const confirmCancel = () => {
    if (!pendingCancel) {
      return;
    }

    cancelAppointment.mutate(pendingCancel.id, {
      onSuccess: () => {
        setPendingCancel(null);
        setBanner({ variant: 'success', text: 'Appointment cancelled.' });
      },
      onError: (cancelError) => {
        setPendingCancel(null);
        setBanner({ variant: 'error', text: cancelError.message });
      },
    });
  };

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
          onClick={goToSchedule}
          data-testid="schedule-cta"
        >
          Schedule appointment
        </button>
      </header>

      {banner ? (
        <AlertBanner
          variant={banner.variant}
          message={banner.text}
          onDismissed={() => setBanner(null)}
        />
      ) : null}

      <nav className="tabs" role="tablist">
        <button
          type="button"
          className={scope === 'upcoming' ? 'tab tab--active' : 'tab'}
          role="tab"
          aria-selected={scope === 'upcoming'}
          onClick={() => selectScope('upcoming')}
          data-testid="tab-upcoming"
        >
          Upcoming
        </button>
        <button
          type="button"
          className={scope === 'past' ? 'tab tab--active' : 'tab'}
          role="tab"
          aria-selected={scope === 'past'}
          onClick={() => selectScope('past')}
          data-testid="tab-past"
        >
          Past
        </button>
      </nav>

      <AppointmentFilters
        visitTypes={visitTypes}
        disabled={loading}
        onFiltersChanged={setFilters}
      />

      {loading ? <LoadingSpinner message="Loading your appointments…" /> : null}

      {error && !loading ? (
        <div className="stack">
          <AlertBanner variant="error" message={error.message} dismissible={false} />
          <button
            type="button"
            className="button button--ghost"
            onClick={() => void appointmentsQuery.refetch()}
            data-testid="retry"
          >
            Try again
          </button>
        </div>
      ) : null}

      {isEmpty && hasActiveFilters ? (
        <EmptyState
          title="No appointments match these filters"
          message="Clear the filters to see everything in this list."
        />
      ) : null}

      {isEmpty && !hasActiveFilters && scope === 'upcoming' ? (
        <EmptyState
          title="No upcoming appointments"
          message="When you book a visit it will show up here."
          actionLabel="Schedule appointment"
          onAction={goToSchedule}
        />
      ) : null}

      {isEmpty && !hasActiveFilters && scope === 'past' ? (
        <EmptyState
          title="No past appointments"
          message="Completed and cancelled visits will appear here."
        />
      ) : null}

      {!loading && !error && appointments.length > 0 ? (
        <div className="stack">
          {appointments.map((appointment) => (
            <AppointmentCard
              key={appointment.id}
              appointment={appointment}
              onRescheduleRequested={goToReschedule}
              onCancelRequested={setPendingCancel}
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
            ? `This will free up your ${formatShortDateTime(pendingCancel.startsAt)} slot with ${pendingCancel.provider.name}.`
            : ''
        }
        confirmLabel="Yes, cancel it"
        cancelLabel="Keep appointment"
        onConfirmed={confirmCancel}
        onCancelled={() => setPendingCancel(null)}
      />
    </section>
  );
}
