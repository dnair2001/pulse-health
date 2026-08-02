export type VisitTypeId = 'in_person' | 'video' | 'phone';

export interface VisitType {
  id: VisitTypeId;
  label: string;
  durationMinutes: number;
}
