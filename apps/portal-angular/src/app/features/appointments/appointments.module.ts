import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';

import { SharedModule } from '../../shared/shared.module';
import { AppointmentsRoutingModule } from './appointments-routing.module';
import { AppointmentCardComponent } from './components/appointment-card/appointment-card.component';
import { AppointmentFiltersComponent } from './components/appointment-filters/appointment-filters.component';
import { SlotPickerComponent } from './components/slot-picker/slot-picker.component';
import { AppointmentListPageComponent } from './pages/appointment-list/appointment-list.page';
import { AppointmentReschedulePageComponent } from './pages/appointment-reschedule/appointment-reschedule.page';
import { AppointmentSchedulePageComponent } from './pages/appointment-schedule/appointment-schedule.page';

@NgModule({
  declarations: [
    AppointmentListPageComponent,
    AppointmentSchedulePageComponent,
    AppointmentReschedulePageComponent,
    AppointmentCardComponent,
    AppointmentFiltersComponent,
    SlotPickerComponent,
  ],
  imports: [CommonModule, ReactiveFormsModule, SharedModule, AppointmentsRoutingModule],
})
export class AppointmentsModule {}
