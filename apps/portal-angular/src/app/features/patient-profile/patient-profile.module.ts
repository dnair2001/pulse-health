import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';

import { SharedModule } from '../../shared/shared.module';
import { PatientProfileRoutingModule } from './patient-profile-routing.module';
import { PatientProfilePageComponent } from './pages/patient-profile/patient-profile.page';

@NgModule({
  declarations: [PatientProfilePageComponent],
  imports: [CommonModule, ReactiveFormsModule, SharedModule, PatientProfileRoutingModule],
})
export class PatientProfileModule {}
