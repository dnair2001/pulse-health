export type VisitTypeId = 'in_person' | 'video' | 'phone';

const LABELS: Record<VisitTypeId, string> = {
  in_person: 'In person',
  video: 'Video visit',
  phone: 'Phone call',
};

/** Port of Angular's `visitTypeLabel` pipe: unknown values pass through unchanged. */
export function visitTypeLabel(value: VisitTypeId | string | null | undefined): string {
  if (!value) {
    return '';
  }
  return LABELS[value as VisitTypeId] ?? value;
}
