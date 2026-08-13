import angular from 'angular';

import { ProviderDirectoryPageComponent } from './pages/provider-directory/provider-directory.page';
import { ProviderProfilePageComponent } from './pages/provider-profile/provider-profile.page';
import { ProviderDirectoryService } from './services/provider-directory.service';

angular
  .module('portalApp.providers', ['portalApp.shared'])
  .factory('providerDirectoryService', ProviderDirectoryService)
  .component('phProviderDirectoryPage', ProviderDirectoryPageComponent)
  .component('phProviderProfilePage', ProviderProfilePageComponent);
