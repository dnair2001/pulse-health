import { test as base, expect } from '@playwright/test';

import { Api } from './api';

export interface Implementation {
  /** Shows up in test titles. */
  name: 'angular' | 'react';
  /** Prefix the demo server mounts the bundle under. */
  basePath: '' | '/react';
}

/**
 * Every user-flow spec is parameterised over this list, so a flow that only works in one
 * frontend fails rather than passing quietly. Angular is the reference implementation
 * (AGENTS.md invariant 5), so it is listed first and its failures read first.
 */
export const IMPLEMENTATIONS: readonly Implementation[] = [
  { name: 'angular', basePath: '' },
  { name: 'react', basePath: '/react' },
];

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
