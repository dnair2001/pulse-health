import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { ProviderDirectoryPageComponent } from './pages/provider-directory/provider-directory.page';
import { ProviderProfilePageComponent } from './pages/provider-profile/provider-profile.page';

const routes: Routes = [
  { path: '', component: ProviderDirectoryPageComponent, title: 'Provider directory' },
  { path: ':id', component: ProviderProfilePageComponent, title: 'Provider profile' },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ProvidersRoutingModule {}
