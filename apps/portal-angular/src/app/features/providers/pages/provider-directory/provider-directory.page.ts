import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { finalize } from 'rxjs/operators';

import { ApiError, Provider } from '../../../../core/models';
import { ProviderDirectoryService } from '../../services/provider-directory.service';

@Component({
  selector: 'ph-provider-directory-page',
  templateUrl: './provider-directory.page.html',
})
export class ProviderDirectoryPageComponent implements OnInit {
  providers: Provider[] = [];
  search = '';

  loading = false;
  error: ApiError | null = null;

  constructor(
    private readonly providerDirectory: ProviderDirectoryService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  get filteredProviders(): Provider[] {
    const term = this.search.trim().toLowerCase();
    if (!term) {
      return this.providers;
    }
    return this.providers.filter(
      (provider) =>
        provider.name.toLowerCase().includes(term) ||
        provider.specialty.toLowerCase().includes(term),
    );
  }

  get isEmpty(): boolean {
    return !this.loading && !this.error && this.filteredProviders.length === 0;
  }

  load(): void {
    this.loading = true;
    this.error = null;

    this.providerDirectory
      .list()
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (providers) => (this.providers = providers),
        error: (error: ApiError) => {
          this.error = error;
          this.providers = [];
        },
      });
  }

  viewProfile(provider: Provider): void {
    void this.router.navigate(['/providers', provider.id]);
  }
}
