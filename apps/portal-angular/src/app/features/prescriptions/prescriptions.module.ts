import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';

import { SharedModule } from '../../shared/shared.module';
import { PrescriptionListPageComponent } from './pages/prescription-list/prescription-list.page';
import { PrescriptionsRoutingModule } from './prescriptions-routing.module';

@NgModule({
  declarations: [PrescriptionListPageComponent],
  imports: [CommonModule, SharedModule, PrescriptionsRoutingModule],
})
export class PrescriptionsModule {}
