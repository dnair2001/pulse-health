import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { SharedModule } from '../../shared/shared.module';
import { ProviderDirectoryPageComponent } from './pages/provider-directory/provider-directory.page';
import { ProviderProfilePageComponent } from './pages/provider-profile/provider-profile.page';
import { ProvidersRoutingModule } from './providers-routing.module';

@NgModule({
  declarations: [ProviderDirectoryPageComponent, ProviderProfilePageComponent],
  imports: [CommonModule, FormsModule, SharedModule, ProvidersRoutingModule],
})
export class ProvidersModule {}
