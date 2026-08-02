import { CommonModule } from '@angular/common';
import { HTTP_INTERCEPTORS, HttpClientModule } from '@angular/common/http';
import { NgModule, Optional, SkipSelf } from '@angular/core';

import { ApiErrorInterceptor } from './http/api-error.interceptor';

@NgModule({
  imports: [CommonModule, HttpClientModule],
  providers: [{ provide: HTTP_INTERCEPTORS, useClass: ApiErrorInterceptor, multi: true }],
})
export class CoreModule {
  constructor(@Optional() @SkipSelf() parent?: CoreModule) {
    if (parent) {
      throw new Error('CoreModule is already loaded. Import it in AppModule only.');
    }
  }
}
