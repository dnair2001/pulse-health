import { Component, computed, DestroyRef, inject, input, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';

import { ApiError } from '../../../../core/http/api-error';
import { AlertBannerComponent } from '../../../../shared/components/alert-banner/alert-banner.component';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { toBioHtml } from '../../bio-html';
import { Provider } from '../../models/provider';
import { ProviderDirectoryService } from '../../services/provider-directory.service';

@Component({
  selector: 'ph-provider-profile-page',
  imports: [AlertBannerComponent, LoadingSpinnerComponent],
  templateUrl: './provider-profile.page.html',
  styleUrl: './provider-profile.page.scss',
})
export class ProviderProfilePage implements OnInit {
  /** Bound from the `:id` route parameter by the router's component input binding. */
  readonly id = input('');

  private readonly providerDirectory = inject(ProviderDirectoryService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly provider = signal<Provider | null>(null);
  readonly loading = signal(false);
  readonly error = signal<ApiError | null>(null);

  /** See toBioHtml: narrows the bio before Angular's sanitizer, never instead of it. */
  readonly bioHtml = computed(() => toBioHtml(this.provider()?.bio));

  ngOnInit(): void {
    const id = this.id();
    if (!id) {
      void this.router.navigate(['/providers']);
      return;
    }
    this.load(id);
  }

  load(id: string): void {
    this.loading.set(true);
    this.error.set(null);

    this.providerDirectory
      .getById(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (provider) => {
          this.provider.set(provider);
          this.loading.set(false);
        },
        // An unknown id arrives here as the API's NOT_FOUND envelope, mapped to an ApiError
        // by apiErrorInterceptor, and is rendered as the error banner below rather than
        // being left as a blank page or an uncaught rejection.
        error: (error: ApiError) => {
          this.error.set(error);
          this.provider.set(null);
          this.loading.set(false);
        },
      });
  }

  goBack(): void {
    void this.router.navigate(['/providers']);
  }
}
