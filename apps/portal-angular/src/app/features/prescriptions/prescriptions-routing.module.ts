import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { PrescriptionListPageComponent } from './pages/prescription-list/prescription-list.page';

const routes: Routes = [
  { path: '', component: PrescriptionListPageComponent, title: 'Prescriptions' },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class PrescriptionsRoutingModule {}
