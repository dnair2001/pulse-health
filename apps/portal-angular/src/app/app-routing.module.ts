import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  { path: '', redirectTo: 'appointments', pathMatch: 'full' },
  {
    path: 'appointments',
    loadChildren: () =>
      import('./features/appointments/appointments.module').then((m) => m.AppointmentsModule),
  },
  {
    path: 'providers',
    loadChildren: () =>
      import('./features/providers/providers.module').then((m) => m.ProvidersModule),
  },
  { path: '**', redirectTo: 'appointments' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
