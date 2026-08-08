import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { DashboardPageComponent } from './pages/dashboard/dashboard.page';

const routes: Routes = [{ path: '', component: DashboardPageComponent, title: 'Dashboard' }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class DashboardRoutingModule {}
