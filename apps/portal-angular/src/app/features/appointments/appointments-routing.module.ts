import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { AppointmentListPageComponent } from './pages/appointment-list/appointment-list.page';
import { AppointmentReschedulePageComponent } from './pages/appointment-reschedule/appointment-reschedule.page';
import { AppointmentSchedulePageComponent } from './pages/appointment-schedule/appointment-schedule.page';

const routes: Routes = [
  { path: '', component: AppointmentListPageComponent, title: 'Your appointments' },
  { path: 'schedule', component: AppointmentSchedulePageComponent, title: 'Schedule an appointment' },
  {
    path: ':id/reschedule',
    component: AppointmentReschedulePageComponent,
    title: 'Reschedule appointment',
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AppointmentsRoutingModule {}
