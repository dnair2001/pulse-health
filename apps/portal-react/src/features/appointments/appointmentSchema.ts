import { z } from 'zod';

/**
 * Ports the Angular reactive-form validators of the schedule and reschedule pages, including
 * `trimmedRequired(REASON_MIN_LENGTH)`, which trims before deciding between `required` and
 * `minlength`. Messages are the ones the Angular templates rendered, byte for byte.
 */

export const REASON_MIN_LENGTH = 3;
export const REASON_MAX_LENGTH = 500;

export const PROVIDER_REQUIRED_MESSAGE = 'Please choose a provider.';
export const SLOT_REQUIRED_MESSAGE = 'Please choose a time slot.';
export const VISIT_TYPE_REQUIRED_MESSAGE = 'Please choose a visit type.';
export const REASON_REQUIRED_MESSAGE = 'A reason for the visit is required.';
export const REASON_MIN_LENGTH_MESSAGE = 'Please add a little more detail.';

/**
 * The Angular template had no span for `maxlength`: the textarea's `maxlength` attribute keeps
 * the value inside the limit, and a form that somehow exceeds it is simply invalid and cannot be
 * submitted. This message therefore exists to block the submit, not to be rendered.
 */
export const REASON_MAX_LENGTH_MESSAGE = `Please keep the reason to ${REASON_MAX_LENGTH} characters or fewer.`;

export const NEW_SLOT_REQUIRED_MESSAGE = 'Please choose a new time slot.';

const reasonSchema = z.string().superRefine((value, ctx) => {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    ctx.addIssue({ code: 'custom', message: REASON_REQUIRED_MESSAGE });
  } else if (trimmed.length < REASON_MIN_LENGTH) {
    ctx.addIssue({ code: 'custom', message: REASON_MIN_LENGTH_MESSAGE });
  }

  // `Validators.maxLength` measured the raw value, not the trimmed one.
  if (value.length > REASON_MAX_LENGTH) {
    ctx.addIssue({ code: 'custom', message: REASON_MAX_LENGTH_MESSAGE });
  }
});

export const scheduleFormSchema = z.object({
  providerId: z.string().min(1, PROVIDER_REQUIRED_MESSAGE),
  slotId: z.string().min(1, SLOT_REQUIRED_MESSAGE),
  visitType: z.string().min(1, VISIT_TYPE_REQUIRED_MESSAGE),
  reason: reasonSchema,
});

export const rescheduleFormSchema = z.object({
  slotId: z.string().min(1, NEW_SLOT_REQUIRED_MESSAGE),
});

export type ScheduleFormValues = z.infer<typeof scheduleFormSchema>;
export type RescheduleFormValues = z.infer<typeof rescheduleFormSchema>;
