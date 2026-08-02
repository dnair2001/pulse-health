import { Component, inject, signal } from '@angular/core';

import { Api, Health } from '../../core/api';

@Component({
  selector: 'app-home',
  templateUrl: './home.html'
})
export class Home {
  private readonly api = inject(Api);

  protected readonly health = signal<Health | null>(null);
  protected readonly error = signal<string | null>(null);

  constructor() {
    this.api.health().subscribe({
      next: (health) => this.health.set(health),
      error: () => this.error.set('Backend unreachable. Start the API on port 8000.')
    });
  }
}
