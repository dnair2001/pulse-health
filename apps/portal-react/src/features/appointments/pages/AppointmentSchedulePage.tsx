import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';

import { isApiError } from '../../../api/client';
import { useProviders, useScheduleAppointment, useSlots, useVisitTypes } from '../../../api/queries';
import type { ApiError, VisitTypeId } from '../../../api/types';
import { useNotifications } from '../../../notifications/NotificationProvider';
import { AlertBanner } from '../../../shared/AlertBanner';
import { LoadingSpinner } from '../../../shared/LoadingSpinner';
import { SlotPicker } from '../components/SlotPicker';
import { REASON_MAX_LENGTH, scheduleSchema } from '../appointmentSchema';
import type { ScheduleFormValues } from '../appointmentSchema';

export function AppointmentSchedulePage() {
  const navigate = useNavigate();
  const notifications = useNotifications();

  const [serverError, setServerError] = useState<ApiError | null>(null);

  const providers = useProviders();
  const visitTypes = useVisitTypes();
  const schedule = useScheduleAppointment();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ScheduleFormValues>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: { providerId: '', slotId: '', visitType: '', reason: '' },
  });

  const providerId = watch('providerId');
  const slotId = watch('slotId');
  const slots = useSlots({ providerId: providerId || undefined });

  const referenceError = isApiError(providers.error) ? providers.error : null;

  function onProviderChange(nextProviderId: string) {
    setValue('providerId', nextProviderId);
    setValue('slotId', '');
    // Only a provider change clears the banner. Refreshing availability after a
    // rejected booking must leave the message on screen.
    setServerError(null);
  }

  function applyServerError(error: ApiError) {
    setServerError(error);

    // The chosen slot is gone or invalid, so drop it and refresh availability. The value
    // is cleared first because setting it after setError would revalidate and wipe the error.
    if (error.code === 'SLOT_ALREADY_BOOKED' || error.code === 'SLOT_IN_PAST') {
      setValue('slotId', '');
      void slots.refetch();
    }

    if (error.field === 'providerId' || error.field === 'slotId' || error.field === 'reason') {
      setError(error.field, { type: 'server', message: error.message });
    }
  }

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);

    try {
      await schedule.mutateAsync({
        providerId: values.providerId,
        slotId: values.slotId,
        visitType: values.visitType as VisitTypeId,
        reason: values.reason.trim(),
      });
      notifications.success('Appointment scheduled.');
      navigate('/appointments');
    } catch (error) {
      if (isApiError(error)) {
        applyServerError(error);
      }
    }
  });

  return (
    <section className="page">
      <header className="page__header">
        <div>
          <h1 className="page__title">Schedule an appointment</h1>
          <p className="page__subtitle">
            Pick a provider, choose an open time, and tell us why you&apos;re coming in.
          </p>
        </div>
      </header>

      {referenceError ? (
        <AlertBanner variant="error" message={referenceError.message} dismissible={false} />
      ) : null}

      {serverError ? (
        <AlertBanner
          variant="error"
          message={serverError.message}
          onDismiss={() => setServerError(null)}
        />
      ) : null}

      {providers.isPending ? <LoadingSpinner label="Loading providers…" /> : null}

      {!providers.isPending ? (
        <form className="form" onSubmit={onSubmit} noValidate>
          <label className="field">
            <span className="field__label">Provider</span>
            <select
              value={providerId}
              onChange={(event) => onProviderChange(event.target.value)}
              data-testid="provider-select"
            >
              <option value="">Choose a provider</option>
              {(providers.data ?? []).map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.name} · {provider.specialty}
                </option>
              ))}
            </select>
            {errors.providerId ? (
              <span className="field__error">{errors.providerId.message}</span>
            ) : null}
          </label>

          <fieldset className="field">
            <legend className="field__label">Available times</legend>
            <SlotPicker
              slots={slots.data ?? []}
              value={slotId}
              onChange={(id) => setValue('slotId', id, { shouldValidate: true })}
              loading={slots.isFetching}
            />
            {errors.slotId ? (
              <span
                className="field__error"
                data-testid={errors.slotId.type === 'server' ? 'slot-server-error' : 'slot-error'}
              >
                {errors.slotId.message}
              </span>
            ) : null}
          </fieldset>

          <label className="field">
            <span className="field__label">Visit type</span>
            <select {...register('visitType')} data-testid="visit-type-select">
              <option value="">Choose a visit type</option>
              {(visitTypes.data ?? []).map((visitType) => (
                <option key={visitType.id} value={visitType.id}>
                  {visitType.label} ({visitType.durationMinutes} min)
                </option>
              ))}
            </select>
            {errors.visitType ? (
              <span className="field__error">{errors.visitType.message}</span>
            ) : null}
          </label>

          <label className="field">
            <span className="field__label">Reason for visit</span>
            <textarea
              {...register('reason')}
              rows={4}
              maxLength={REASON_MAX_LENGTH}
              placeholder="Annual physical, follow-up on lab results, persistent cough…"
              data-testid="reason-input"
            />
            {errors.reason ? (
              <span className="field__error" data-testid="reason-error">
                {errors.reason.message}
              </span>
            ) : null}
          </label>

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
              data-testid="submit-appointment"
            >
              {isSubmitting ? 'Scheduling…' : 'Confirm appointment'}
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
