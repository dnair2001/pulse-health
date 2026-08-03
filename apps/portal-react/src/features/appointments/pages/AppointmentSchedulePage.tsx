import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useController, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';

import { useProviders, useScheduleAppointment, useSlots, useVisitTypes } from '../../../api/queries';
import type { ApiError, VisitTypeId } from '../../../api/types';
import { useNotifications } from '../../../notifications/NotificationProvider';
import { AlertBanner } from '../../../shared/AlertBanner';
import { LoadingSpinner } from '../../../shared/LoadingSpinner';
import { SlotPicker } from '../components/SlotPicker';
import {
  REASON_MAX_LENGTH,
  REASON_MIN_LENGTH_MESSAGE,
  REASON_REQUIRED_MESSAGE,
  SLOT_REQUIRED_MESSAGE,
  scheduleFormSchema,
} from '../appointmentSchema';
import type { ScheduleFormValues } from '../appointmentSchema';

const FORM_FIELDS = ['providerId', 'slotId', 'visitType', 'reason'] as const;

function isFormField(field: string | null): field is keyof ScheduleFormValues {
  return field !== null && (FORM_FIELDS as readonly string[]).includes(field);
}

export function AppointmentSchedulePage() {
  const navigate = useNavigate();
  const notifications = useNotifications();

  const [serverError, setServerError] = useState<ApiError | null>(null);

  const {
    clearErrors,
    control,
    formState: { errors, isSubmitted },
    handleSubmit,
    register,
    setError,
    setValue,
    trigger,
    watch,
  } = useForm<ScheduleFormValues>({
    resolver: zodResolver(scheduleFormSchema),
    defaultValues: { providerId: '', slotId: '', visitType: '', reason: '' },
  });

  const providerId = watch('providerId');

  const providersQuery = useProviders();
  const visitTypesQuery = useVisitTypes();
  const slotsQuery = useSlots(providerId === '' ? undefined : { providerId });
  const scheduleMutation = useScheduleAppointment();

  const slotsError = slotsQuery.error;

  // Angular's `catchError` pushed the availability failure into the same page-level banner,
  // so a broken `GET /api/slots` is never silently reported as "no open time slots".
  useEffect(() => {
    if (slotsError) {
      setServerError(slotsError);
    }
  }, [slotsError]);

  const slotField = useController({ control, name: 'slotId' });

  const providers = providersQuery.data ?? [];
  const visitTypes = visitTypesQuery.data ?? [];
  const slots = slotsQuery.data ?? [];
  const referenceError = providersQuery.error;
  const loadingReferenceData = providersQuery.isLoading;

  const providerRegistration = register('providerId', {
    onChange: () => {
      // Angular revalidated the whole group on every value change, which both dropped the
      // stale `required` error on the provider and discarded the server error attached to a
      // slot that belongs to the provider the user just navigated away from.
      setValue('slotId', '');
      clearErrors(['providerId', 'slotId']);
      setServerError(null);
      if (isSubmitted) {
        void trigger(['providerId', 'slotId']);
      }
    },
  });

  function applyServerError(error: ApiError): void {
    setServerError(error);

    // The chosen slot is gone or invalid, so drop it and refresh availability. Clearing the
    // value must not revalidate, because that would wipe the field-level error set below.
    if (error.code === 'SLOT_ALREADY_BOOKED' || error.code === 'SLOT_IN_PAST') {
      setValue('slotId', '');
      if (providerId !== '') {
        void slotsQuery.refetch();
      }
    }

    if (isFormField(error.field)) {
      setError(error.field, { type: 'server', message: error.message });
    }
  }

  function onValid(values: ScheduleFormValues): void {
    scheduleMutation.mutate(
      {
        providerId: values.providerId,
        slotId: values.slotId,
        visitType: values.visitType as VisitTypeId,
        reason: values.reason.trim(),
      },
      {
        onSuccess: () => {
          notifications.success('Appointment scheduled.');
          void navigate('/appointments');
        },
        onError: (error) => applyServerError(error),
      },
    );
  }

  // Angular cleared `serverError` before the invalid-form guard, so a resubmit that fails
  // validation never leaves the previous server banner next to the new field errors.
  function onFormSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setServerError(null);
    void handleSubmit(onValid)(event);
  }

  const providerErrorVisible = Boolean(errors.providerId) && errors.providerId?.type !== 'server';
  const visitTypeErrorVisible = Boolean(errors.visitType) && errors.visitType?.type !== 'server';
  const slotValidationErrorVisible = Boolean(errors.slotId) && errors.slotId?.type !== 'server';
  const slotServerMessage = errors.slotId?.type === 'server' ? errors.slotId.message : null;
  const reasonMessage = errors.reason?.type === 'server' ? undefined : errors.reason?.message;

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
          onDismissed={() => setServerError(null)}
        />
      ) : null}

      {loadingReferenceData ? <LoadingSpinner message="Loading providers…" /> : null}

      {loadingReferenceData ? null : (
        <form className="form" onSubmit={onFormSubmit}>
          <label className="field">
            <span className="field__label">Provider</span>
            <select {...providerRegistration} data-testid="provider-select">
              <option value="">Choose a provider</option>
              {providers.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.name} · {provider.specialty}
                </option>
              ))}
            </select>
            {providerErrorVisible ? (
              <span className="field__error">Please choose a provider.</span>
            ) : null}
          </label>

          <fieldset className="field">
            <legend className="field__label">Available times</legend>
            {slotsError ? null : (
              <SlotPicker
                slots={slots}
                loading={slotsQuery.isFetching}
                value={slotField.field.value === '' ? null : slotField.field.value}
                onChange={(slotId) => slotField.field.onChange(slotId ?? '')}
              />
            )}
            {slotValidationErrorVisible ? (
              <span className="field__error" data-testid="slot-error">
                {SLOT_REQUIRED_MESSAGE}
              </span>
            ) : null}
            {slotServerMessage ? (
              <span className="field__error" data-testid="slot-server-error">
                {slotServerMessage}
              </span>
            ) : null}
          </fieldset>

          <label className="field">
            <span className="field__label">Visit type</span>
            <select {...register('visitType')} data-testid="visit-type-select">
              <option value="">Choose a visit type</option>
              {visitTypes.map((visitType) => (
                <option key={visitType.id} value={visitType.id}>
                  {visitType.label} ({visitType.durationMinutes} min)
                </option>
              ))}
            </select>
            {visitTypeErrorVisible ? (
              <span className="field__error">Please choose a visit type.</span>
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
            {reasonMessage === REASON_REQUIRED_MESSAGE ? (
              <span className="field__error" data-testid="reason-error">
                {REASON_REQUIRED_MESSAGE}
              </span>
            ) : null}
            {reasonMessage === REASON_MIN_LENGTH_MESSAGE ? (
              <span className="field__error">{REASON_MIN_LENGTH_MESSAGE}</span>
            ) : null}
          </label>

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
              disabled={scheduleMutation.isPending}
              data-testid="submit-appointment"
            >
              {scheduleMutation.isPending ? 'Scheduling…' : 'Confirm appointment'}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
