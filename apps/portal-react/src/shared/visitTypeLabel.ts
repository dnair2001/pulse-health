const LABELS: Record<string, string> = {
  in_person: 'In person',
  video: 'Video visit',
  phone: 'Phone call',
};

/** Unknown values pass through unchanged, matching the Angular pipe. */
export function visitTypeLabel(value: string | null | undefined): string {
  if (!value) {
    return '';
  }
  return LABELS[value] ?? value;
}
