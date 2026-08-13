import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, ErrorHandler, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';

import { apiErrorInterceptor } from './core/http/api-error.interceptor';
import { GlobalErrorHandler } from './core/observability/global-error-handler';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withInterceptors([apiErrorInterceptor])),
    // withComponentInputBinding lets ProviderProfilePage take the `:id` route parameter as a
    // plain component input instead of reading it from ActivatedRoute.
    provideRouter(routes, withComponentInputBinding()),
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
  ],
};
