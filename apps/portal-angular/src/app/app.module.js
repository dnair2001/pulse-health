import angular from 'angular';

import './core/core.module';
import './shared/shared.module';
import './features/providers/providers.module';
import { AppRootComponent } from './app.component';

angular
  .module('portalApp', ['ngRoute', 'ngSanitize', 'portalApp.core', 'portalApp.shared', 'portalApp.providers'])
  .component('phAppRoot', AppRootComponent)
  .config([
    '$locationProvider',
    /** @param {angular.ILocationProvider} $locationProvider */
    ($locationProvider) => {
      $locationProvider.html5Mode(true);
    },
  ])
  .config([
    '$routeProvider',
    /** @param {angular.route.IRouteProvider} $routeProvider */
    ($routeProvider) => {
      $routeProvider
        .when('/providers', { template: '<ph-provider-directory-page></ph-provider-directory-page>' })
        .when('/providers/:id', { template: '<ph-provider-profile-page></ph-provider-profile-page>' })
        .otherwise({ redirectTo: '/providers' });
    },
  ]);
