import { z } from 'zod';

export const REASON_MIN_LENGTH = 3;
export const REASON_MAX_LENGTH = 500;

/** Rejects values that are empty once trimmed, so " " does not pass as a reason. */
const reason = z.string().superRefine((value, ctx) => {
  const trimmed = value.trim();

  if (!trimmed) {
    ctx.addIssue({ code: 'custom', message: 'A reason for the visit is required.' });
    return;
  }
  if (trimmed.length < REASON_MIN_LENGTH) {
    ctx.addIssue({ code: 'custom', message: 'Please add a little more detail.' });
  }
});

export const scheduleSchema = z.object({
  providerId: z.string().min(1, 'Please choose a provider.'),
  slotId: z.string().min(1, 'Please choose a time slot.'),
  visitType: z.string().min(1, 'Please choose a visit type.'),
  reason,
});

export type ScheduleFormValues = z.infer<typeof scheduleSchema>;

export const rescheduleSchema = z.object({
  slotId: z.string().min(1, 'Please choose a new time slot.'),
});

export type RescheduleFormValues = z.infer<typeof rescheduleSchema>;
