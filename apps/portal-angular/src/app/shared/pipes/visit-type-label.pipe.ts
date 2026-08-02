import { Pipe, PipeTransform } from '@angular/core';

import { VisitTypeId } from '../../core/models';

const LABELS: Record<VisitTypeId, string> = {
  in_person: 'In person',
  video: 'Video visit',
  phone: 'Phone call',
};

@Pipe({ name: 'visitTypeLabel' })
export class VisitTypeLabelPipe implements PipeTransform {
  transform(value: VisitTypeId | string | null | undefined): string {
    if (!value) {
      return '';
    }
    return LABELS[value as VisitTypeId] ?? value;
  }
}
