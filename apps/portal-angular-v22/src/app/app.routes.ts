import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'providers',
    loadComponent: () =>
      import('./features/providers/pages/provider-directory/provider-directory.page').then(
        (m) => m.ProviderDirectoryPage,
      ),
  },
  {
    path: 'providers/:id',
    loadComponent: () =>
      import('./features/providers/pages/provider-profile/provider-profile.page').then(
        (m) => m.ProviderProfilePage,
      ),
  },
  { path: '**', redirectTo: 'providers' },
];
