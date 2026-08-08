import { test as base, expect } from '@playwright/test';

import { Api } from './api';

export interface Implementation {
  /** Shows up in test titles. */
  name: 'angular';
  /** Prefix the demo server mounts the bundle under. */
  basePath: '';
}

/**
 * Every user-flow spec is parameterised over this list. It holds one entry today (Angular is
 * the only frontend, see AGENTS.md); the loop stays in place so a second implementation — the
 * eventual React port — can be added back by extending this array rather than rewriting every
 * spec.
 */
export const IMPLEMENTATIONS: readonly Implementation[] = [{ name: 'angular', basePath: '' }];

interface Fixtures {
  api: Api;
  /** Auto fixture: reseeds the shared store before and after every test. */
  freshState: void;
}

export const test = base.extend<Fixtures>({
  api: async ({ request }, use) => {
    await use(new Api(request));
  },
  freshState: [
    async ({ api }, use) => {
      await api.reset();
      await use();
      await api.reset();
    },
    { auto: true },
  ],
});

export { expect };
