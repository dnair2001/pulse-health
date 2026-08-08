import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';

import { SharedModule } from '../../shared/shared.module';
import { DashboardRoutingModule } from './dashboard-routing.module';
import { DashboardPageComponent } from './pages/dashboard/dashboard.page';

@NgModule({
  declarations: [DashboardPageComponent],
  imports: [CommonModule, SharedModule, DashboardRoutingModule],
})
export class DashboardModule {}
