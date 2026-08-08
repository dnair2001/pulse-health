import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';

import { SharedModule } from '../../shared/shared.module';
import { BillingRoutingModule } from './billing-routing.module';
import { InvoiceListPageComponent } from './pages/invoice-list/invoice-list.page';

@NgModule({
  declarations: [InvoiceListPageComponent],
  imports: [CommonModule, ReactiveFormsModule, SharedModule, BillingRoutingModule],
})
export class BillingModule {}
