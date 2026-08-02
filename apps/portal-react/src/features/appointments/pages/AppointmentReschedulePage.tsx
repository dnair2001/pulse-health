import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useParams } from 'react-router-dom';

import { isApiError } from '../../../api/client';
import { useAppointment, useRescheduleAppointment, useSlots } from '../../../api/queries';
import type { ApiError } from '../../../api/types';
import { useNotifications } from '../../../notifications/NotificationProvider';
import { AlertBanner } from '../../../shared/AlertBanner';
import { LoadingSpinner } from '../../../shared/LoadingSpinner';
import { StatusBadge } from '../../../shared/StatusBadge';
import { formatLongWhen } from '../../../shared/formatDateTime';
import { visitTypeLabel } from '../../../shared/visitTypeLabel';
import { SlotPicker } from '../components/SlotPicker';
import { rescheduleSchema } from '../appointmentSchema';
import type { RescheduleFormValues } from '../appointmentSchema';

export function AppointmentReschedulePage() {
  const navigate = useNavigate();
  const notifications = useNotifications();
  const { id } = useParams<{ id: string }>();

  const [serverError, setServerError] = useState<ApiError | null>(null);

  const appointmentQuery = useAppointment(id);
  const appointment = appointmentQuery.data;
  const reschedule = useRescheduleAppointment(id ?? '');
  const slots = useSlots({ providerId: appointment?.providerId });

  const {
    handleSubmit,
    watch,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RescheduleFormValues>({
    resolver: zodResolver(rescheduleSchema),
    defaultValues: { slotId: '' },
  });

  const slotId = watch('slotId');
  const loadError = isApiError(appointmentQuery.error) ? appointmentQuery.error : null;
  const canReschedule = appointment?.status === 'scheduled';

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);

    try {
      await reschedule.mutateAsync({ slotId: values.slotId });
      notifications.success('Appointment rescheduled.');
      navigate('/appointments');
    } catch (error) {
      if (!isApiError(error)) {
        return;
      }
      setServerError(error);

      // Clear the stale slot before setting the error, otherwise revalidation drops it.
      if (error.code === 'SLOT_ALREADY_BOOKED' || error.code === 'SLOT_IN_PAST') {
        setValue('slotId', '');
        void slots.refetch();
      }
      if (error.field === 'slotId') {
        setError('slotId', { type: 'server', message: error.message });
      }
    }
  });

  return (
    <section className="page">
      <header className="page__header">
        <div>
          <h1 className="page__title">Reschedule appointment</h1>
          <p className="page__subtitle">
            Choose a new time. Your original slot is released once confirmed.
          </p>
        </div>
      </header>

      {appointmentQuery.isPending ? <LoadingSpinner label="Loading appointment…" /> : null}

      {loadError ? (
        <AlertBanner variant="error" message={loadError.message} dismissible={false} />
      ) : null}

      {serverError ? (
        <AlertBanner
          variant="error"
          message={serverError.message}
          onDismiss={() => setServerError(null)}
        />
      ) : null}

      {appointment && !appointmentQuery.isPending ? (
        <>
          <div className="card" data-testid="current-appointment">
            <h2 className="card__title">Current time</h2>
            <p>
              {formatLongWhen(appointment.startsAt)} with {appointment.provider.name} (
              {visitTypeLabel(appointment.visitType)})
            </p>
            <StatusBadge status={appointment.status} />
          </div>

          {!canReschedule ? (
            <AlertBanner
              variant="info"
              message="Only scheduled appointments can be rescheduled."
              dismissible={false}
            />
          ) : null}

          {canReschedule ? (
            <form className="form" onSubmit={onSubmit} noValidate>
              <fieldset className="field">
                <legend className="field__label">New time</legend>
                <SlotPicker
                  slots={slots.data ?? []}
                  value={slotId}
                  onChange={(nextSlotId) =>
                    setValue('slotId', nextSlotId, { shouldValidate: true })
                  }
                  loading={slots.isFetching}
                />
                {errors.slotId ? (
                  <span className="field__error" data-testid="slot-error">
                    {errors.slotId.message}
                  </span>
                ) : null}
              </fieldset>

              <div className="form__actions">
                <button
                  type="button"
                  className="button button--ghost"
                  onClick={() => navigate('/appointments')}
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="button button--primary"
                  disabled={isSubmitting}
                  data-testid="submit-reschedule"
                >
                  {isSubmitting ? 'Rescheduling…' : 'Confirm new time'}
                </button>
              </div>
            </form>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
