import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';

import { ApiError } from '../../../../core/http/api-error';
import { AlertBannerComponent } from '../../../../shared/components/alert-banner/alert-banner.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { Provider } from '../../models/provider';
import { ProviderDirectoryService } from '../../services/provider-directory.service';

@Component({
  selector: 'ph-provider-directory-page',
  imports: [AlertBannerComponent, EmptyStateComponent, LoadingSpinnerComponent],
  templateUrl: './provider-directory.page.html',
  styleUrl: './provider-directory.page.scss',
})
export class ProviderDirectoryPage implements OnInit {
  private readonly providerDirectory = inject(ProviderDirectoryService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly providers = signal<Provider[]>([]);
  readonly search = signal('');
  readonly loading = signal(false);
  readonly error = signal<ApiError | null>(null);

  /** `GET /api/providers` takes no search parameter, so name/specialty matching happens here. */
  readonly filteredProviders = computed(() => {
    const term = this.search().trim().toLowerCase();
    if (!term) {
      return this.providers();
    }
    return this.providers().filter(
      (provider) =>
        provider.name.toLowerCase().includes(term) ||
        provider.specialty.toLowerCase().includes(term),
    );
  });

  readonly isEmpty = computed(
    () => !this.loading() && !this.error() && this.filteredProviders().length === 0,
  );

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);

    this.providerDirectory
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (providers) => {
          this.providers.set(providers);
          this.loading.set(false);
        },
        error: (error: ApiError) => {
          this.error.set(error);
          this.providers.set([]);
          this.loading.set(false);
        },
      });
  }

  viewProfile(provider: Provider): void {
    void this.router.navigate(['/providers', provider.id]);
  }
}
