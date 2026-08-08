import { Component, OnInit } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs/operators';

import { ApiError, Provider } from '../../../../core/models';
import { ProviderDirectoryService } from '../../services/provider-directory.service';

@Component({
  selector: 'ph-provider-profile-page',
  templateUrl: './provider-profile.page.html',
})
export class ProviderProfilePageComponent implements OnInit {
  provider: Provider | null = null;
  loading = false;
  error: ApiError | null = null;

  constructor(
    private readonly providerDirectory: ProviderDirectoryService,
    private readonly sanitizer: DomSanitizer,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      void this.router.navigate(['/providers']);
      return;
    }
    this.load(id);
  }

  /**
   * Bios come from the internal onboarding tool and may contain basic formatting
   * (`<strong>`, `<br>`) that plain interpolation would render as literal tags instead of
   * escaping them, so this bypasses Angular's HTML sanitizer rather than stripping every
   * element out. There is no user-facing way to edit a bio from this portal.
   */
  get trustedBio(): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(this.provider?.bio ?? '');
  }

  load(id: string): void {
    this.loading = true;
    this.error = null;

    this.providerDirectory
      .getById(id)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (provider) => (this.provider = provider),
        error: (error: ApiError) => {
          this.error = error;
          this.provider = null;
        },
      });
  }

  goBack(): void {
    void this.router.navigate(['/providers']);
  }
}
