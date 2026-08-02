import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { AppointmentStatus, VisitType, VisitTypeId } from '../../../../core/models';

export interface AppointmentFilterValue {
  status: AppointmentStatus | '';
  visitType: VisitTypeId | '';
}

@Component({
  selector: 'ph-appointment-filters',
  templateUrl: './appointment-filters.component.html',
})
export class AppointmentFiltersComponent implements OnInit, OnDestroy {
  @Input() visitTypes: VisitType[] = [];
  @Input() disabled = false;

  @Output() filtersChanged = new EventEmitter<AppointmentFilterValue>();

  readonly statuses: AppointmentStatus[] = ['scheduled', 'completed', 'cancelled'];

  form!: FormGroup;

  private readonly destroyed = new Subject<void>();

  constructor(private readonly formBuilder: FormBuilder) {}

  ngOnInit(): void {
    this.form = this.formBuilder.group({ status: [''], visitType: [''] });

    this.form.valueChanges
      .pipe(takeUntil(this.destroyed))
      .subscribe((value) => this.filtersChanged.emit(value as AppointmentFilterValue));
  }

  ngOnDestroy(): void {
    this.destroyed.next();
    this.destroyed.complete();
  }

  reset(): void {
    this.form.setValue({ status: '', visitType: '' });
  }
}
