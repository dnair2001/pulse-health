import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { PatientProfilePageComponent } from './pages/patient-profile/patient-profile.page';

const routes: Routes = [{ path: '', component: PatientProfilePageComponent, title: 'My profile' }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class PatientProfileRoutingModule {}
