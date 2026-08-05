import type { Page } from '@playwright/test';

import { expect, test } from './support/fixtures';
import {
  appointmentCards,
  gotoAppointmentList,
  gotoSchedulePage,
  mainRegion,
  slotDayHeadings,
  waitForListSettled,
} from './support/pages';
import { describeTextDiff, normaliseText } from './support/text';

/**
 * The reason this repo exists: the Angular app and the React app are ports of one feature and
 * must render identical user-visible text (AGENTS.md invariant 3). The demo server puts both
 * bundles and one API on a single origin, so a single run can load each route twice and diff it.
 *
 * Both pages read the same backend, so they are looking at identical data and any difference is
 * a rendering difference.
 */

interface PrepareContext {
  providerCount: number;
}

interface RoutePair {
  title: string;
  /** Label for failure messages; the actual URL is '' or '/react' plus the route. */
  route: string;
  prepare: (page: Page, basePath: string, context: PrepareContext) => Promise<void>;
}

const ROUTE_PAIRS: RoutePair[] = [
  {
    title: 'the appointments list',
    route: '/appointments',
    prepare: async (page, basePath) => {
      await gotoAppointmentList(page, basePath);
    },
  },
  {
    title: 'the appointments list on the Past tab',
    route: '/appointments (Past tab)',
    prepare: async (page, basePath) => {
      await gotoAppointmentList(page, basePath);
      await page.getByTestId('tab-past').click();
      await waitForListSettled(page);
    },
  },
  {
    title: 'the schedule page',
    route: '/appointments/schedule',
    prepare: async (page, basePath, { providerCount }) => {
      await gotoSchedulePage(page, basePath, providerCount);
    },
  },
  {
    title: 'the schedule page with a provider chosen',
    route: '/appointments/schedule (provider chosen)',
    prepare: async (page, basePath, { providerCount }) => {
      await gotoSchedulePage(page, basePath, providerCount);
      await page.getByTestId('provider-select').selectOption('prv_001');
      await expect(slotDayHeadings(page)).not.toHaveCount(0);
      await expect(page.getByTestId('loading-spinner')).toHaveCount(0);
    },
  },
  {
    title: 'the cancel confirmation dialog',
    route: '/appointments (cancel dialog open)',
    prepare: async (page, basePath) => {
      await gotoAppointmentList(page, basePath);
      await appointmentCards(page).first().locator('[data-testid^="cancel-apt_"]').click();
      await expect(page.getByTestId('confirm-dialog')).toBeVisible();
    },
  },
];

async function renderedTestIds(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-testid]'))
      .map((element) => element.getAttribute('data-testid') ?? '')
      .sort(),
  );
}

for (const pair of ROUTE_PAIRS) {
  test(`Angular and React render identical text for ${pair.title}`, async ({ api, browser }) => {
    const providerCount = (await api.providers()).length;
    const context = await browser.newContext();

    try {
      const angularPage = await context.newPage();
      const reactPage = await context.newPage();

      await pair.prepare(angularPage, '', { providerCount });
      await pair.prepare(reactPage, '/react', { providerCount });

      const angularText = normaliseText(await mainRegion(angularPage).innerText());
      const reactText = normaliseText(await mainRegion(reactPage).innerText());

      expect(angularText.length, `${pair.route} rendered no text in Angular`).toBeGreaterThan(0);

      expect(
        reactText,
        [
          `React diverged from Angular (the reference implementation) on ${pair.route}.`,
          'Runs of whitespace were collapsed; nothing else was normalised.',
          describeTextDiff(angularText, reactText),
        ].join('\n'),
      ).toBe(angularText);

      // A testid present in one app and absent in the other means a shared selector silently
      // stops working against one implementation, so it is treated as a divergence too.
      const angularTestIds = await renderedTestIds(angularPage);
      const reactTestIds = await renderedTestIds(reactPage);
      expect(
        reactTestIds,
        `data-testid attributes differ between the two apps on ${pair.route}.`,
      ).toEqual(angularTestIds);
    } finally {
      await context.close();
    }
  });
}
