import angular from 'angular';

import { apiErrorInterceptor } from './http/api-error.interceptor';
import { globalExceptionHandlerDecorator } from './observability/global-error-handler';
import { TelemetryService } from './observability/telemetry.service';
import { NotificationService } from './services/notification.service';

angular
  .module('portalApp.core', [])
  .factory('telemetryService', TelemetryService)
  .factory('notificationService', NotificationService)
  .factory('apiErrorInterceptor', apiErrorInterceptor)
  .config([
    '$httpProvider',
    ($httpProvider) => {
      $httpProvider.interceptors.push('apiErrorInterceptor');
    },
  ])
  .decorator('$exceptionHandler', globalExceptionHandlerDecorator);
