import { expect, type Locator, type Page } from '@playwright/test';

/**
 * `data-testid="appointment-when"` (a `dd`) and `data-testid="appointment-filters"` (a `form`)
 * both share the `appointment-` prefix, so the row locator is pinned to the card element.
 */
export const APPOINTMENT_CARD = 'article[data-testid^="appointment-"]';

export function appointmentCards(page: Page): Locator {
  return page.locator(APPOINTMENT_CARD);
}

export function mainRegion(page: Page): Locator {
  return page.locator('main.shell__main');
}

/**
 * Waits on a positive signal first and only then on the spinner's absence. Asserting "no
 * spinner" alone would pass in the gap before the app's first paint.
 */
export async function waitForListSettled(page: Page): Promise<void> {
  await expect(
    page.locator(`${APPOINTMENT_CARD}, [data-testid="empty-state"]`).first(),
  ).toBeVisible();
  await expect(page.getByTestId('loading-spinner')).toHaveCount(0);
}

export async function gotoAppointmentList(page: Page, basePath: string): Promise<void> {
  await page.goto(`${basePath}/appointments`);
  await expect(page.getByTestId('appointment-filters')).toBeVisible();
  await waitForListSettled(page);
}

export async function gotoSchedulePage(
  page: Page,
  basePath: string,
  providerCount: number,
): Promise<void> {
  await page.goto(`${basePath}/appointments/schedule`);
  await expect(page.getByTestId('provider-select')).toBeVisible();
  // One `<option>` per provider plus the "Choose a provider" placeholder.
  await expect(page.locator('[data-testid="provider-select"] option')).toHaveCount(
    providerCount + 1,
  );
}

/** Selects a provider and waits for that provider's availability to finish loading. */
export async function chooseProvider(page: Page, providerId: string): Promise<void> {
  await page.getByTestId('provider-select').selectOption(providerId);
  await expect(page.locator('[data-testid="slot-picker"] .slot')).not.toHaveCount(0);
  await expect(page.getByTestId('slot-picker').getByTestId('loading-spinner')).toHaveCount(0);
}

export async function chooseSlot(page: Page, slotId: string): Promise<void> {
  const slot = page.getByTestId(`slot-${slotId}`);
  await slot.click();
  await expect(slot).toHaveAttribute('aria-pressed', 'true');
}

/** Day headings inside the slot picker. Neither app gives these a testid. */
export function slotDayHeadings(page: Page): Locator {
  return page.locator('[data-testid="slot-picker"] .slot-picker__date');
}
