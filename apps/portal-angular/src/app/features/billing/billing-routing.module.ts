import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { InvoiceListPageComponent } from './pages/invoice-list/invoice-list.page';

const routes: Routes = [
  { path: '', component: InvoiceListPageComponent, title: 'Billing & insurance' },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class BillingRoutingModule {}
