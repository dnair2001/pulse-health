import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useController, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useParams } from 'react-router-dom';

import { useAppointment, useRescheduleAppointment, useSlots } from '../../../api/queries';
import type { ApiError } from '../../../api/types';
import { useNotifications } from '../../../notifications/NotificationProvider';
import { AlertBanner } from '../../../shared/AlertBanner';
import { LoadingSpinner } from '../../../shared/LoadingSpinner';
import { StatusBadge } from '../../../shared/StatusBadge';
import { formatFullDateTime } from '../../../shared/formatDateTime';
import { visitTypeLabel } from '../../../shared/visitTypeLabel';
import { SlotPicker } from '../components/SlotPicker';
import { NEW_SLOT_REQUIRED_MESSAGE, rescheduleFormSchema } from '../appointmentSchema';
import type { RescheduleFormValues } from '../appointmentSchema';

/**
 * A route without a usable `:id` can never resolve to an appointment, so the page reports the
 * same failure the API would have returned instead of firing a request for `undefined`.
 */
const MISSING_APPOINTMENT_ERROR: ApiError = {
  code: 'NOT_FOUND',
  message: 'We could not find that appointment.',
  field: 'id',
  status: 404,
};

export function AppointmentReschedulePage() {
  const navigate = useNavigate();
  const notifications = useNotifications();
  const { id } = useParams();

  const appointmentId = id !== undefined && id.trim() !== '' ? id : undefined;

  const [serverError, setServerError] = useState<ApiError | null>(null);

  const {
    control,
    formState: { errors },
    handleSubmit,
    setValue,
  } = useForm<RescheduleFormValues>({
    resolver: zodResolver(rescheduleFormSchema),
    defaultValues: { slotId: '' },
  });

  const appointmentQuery = useAppointment(appointmentId);
  const appointment = appointmentQuery.data ?? null;

  const slotsQuery = useSlots(
    appointment === null ? undefined : { providerId: appointment.providerId },
  );
  const rescheduleMutation = useRescheduleAppointment();

  const slotsError = slotsQuery.error;

  // Angular surfaced a failed availability load in the page banner rather than letting the
  // picker claim the provider has no open times.
  useEffect(() => {
    if (slotsError) {
      setServerError(slotsError);
    }
  }, [slotsError]);

  const slotField = useController({ control, name: 'slotId' });

  const loading = appointmentQuery.isLoading;
  const loadError = appointmentId === undefined ? MISSING_APPOINTMENT_ERROR : appointmentQuery.error;
  const canReschedule = appointment !== null && appointment.status === 'scheduled';

  function onValid(values: RescheduleFormValues): void {
    if (appointment === null) {
      return;
    }

    rescheduleMutation.mutate(
      { id: appointment.id, slotId: values.slotId },
      {
        onSuccess: () => {
          notifications.success('Appointment rescheduled.');
          void navigate('/appointments');
        },
        onError: (error) => {
          setServerError(error);

          // The slot went stale between load and submit, so drop it and reload availability
          // without disturbing the banner that explains why.
          if (error.code === 'SLOT_ALREADY_BOOKED' || error.code === 'SLOT_IN_PAST') {
            setValue('slotId', '');
            void slotsQuery.refetch();
          }
        },
      },
    );
  }

  // Clearing the banner before the invalid-form guard keeps a stale server message from sitting
  // next to the validation error raised by the resubmit.
  function onFormSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setServerError(null);
    void handleSubmit(onValid)(event);
  }

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

      {loading ? <LoadingSpinner message="Loading appointment…" /> : null}

      {loadError ? (
        <AlertBanner variant="error" message={loadError.message} dismissible={false} />
      ) : null}

      {serverError ? (
        <AlertBanner
          variant="error"
          message={serverError.message}
          onDismissed={() => setServerError(null)}
        />
      ) : null}

      {appointment !== null && !loading ? (
        <>
          <div className="card" data-testid="current-appointment">
            <h2 className="card__title">Current time</h2>
            <p>
              {formatFullDateTime(appointment.startsAt)} with {appointment.provider.name} (
              {visitTypeLabel(appointment.visitType)})
            </p>
            <StatusBadge status={appointment.status} />
          </div>

          {canReschedule ? null : (
            <AlertBanner
              variant="info"
              message="Only scheduled appointments can be rescheduled."
              dismissible={false}
            />
          )}

          {canReschedule ? (
            <form className="form" onSubmit={onFormSubmit}>
              <fieldset className="field">
                <legend className="field__label">New time</legend>
                {slotsError ? null : (
                  <SlotPicker
                    slots={slotsQuery.data ?? []}
                    loading={slotsQuery.isFetching}
                    value={slotField.field.value === '' ? null : slotField.field.value}
                    onChange={(slotId) => slotField.field.onChange(slotId ?? '')}
                  />
                )}
                {errors.slotId ? (
                  <span className="field__error">{NEW_SLOT_REQUIRED_MESSAGE}</span>
                ) : null}
              </fieldset>

              <div className="form__actions">
                <button
                  type="button"
                  className="button button--ghost"
                  onClick={() => void navigate('/appointments')}
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="button button--primary"
                  disabled={rescheduleMutation.isPending}
                  data-testid="submit-reschedule"
                >
                  {rescheduleMutation.isPending ? 'Rescheduling…' : 'Confirm new time'}
                </button>
              </div>
            </form>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
