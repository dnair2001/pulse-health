import { expect, test } from './support/fixtures';

test.describe('billing', () => {
  test('lists every seeded invoice and filters by status', async ({ page }) => {
    await page.goto('/billing');

    await expect(page.locator('.invoice')).toHaveCount(5);

    await page.getByTestId('tab-paid').click();
    await expect(page.locator('.invoice')).toHaveCount(1);
  });

  test('flags the overdue invoice with a badge', async ({ page }) => {
    await page.goto('/billing');

    // inv_003 (Newborn wellness visit) is seeded open and past its due date.
    const card = page.getByTestId('invoice-card-inv_003');
    await expect(card.getByTestId('overdue-badge')).toBeVisible();
  });

  test('pays an invoice in full and shows the updated balance', async ({ page }) => {
    await page.goto('/billing');

    // inv_001 (Annual physical): billed 42000, insurance 33600 -> balance 8400.
    const card = page.getByTestId('invoice-card-inv_001');
    await card.getByTestId('pay-balance-inv_001').click();
    await card.getByTestId('submit-payment').click();

    await expect(page.getByTestId('alert-banner')).toContainText('paid in full');
    await expect(page.getByTestId('invoice-card-inv_001')).toContainText('paid');
  });

  test('rejects a payment that exceeds the outstanding balance', async ({ page }) => {
    await page.goto('/billing');

    const card = page.getByTestId('invoice-card-inv_001');
    await card.getByTestId('pay-balance-inv_001').click();
    await card.getByTestId('payment-amount-input').fill('9999');
    await card.getByTestId('submit-payment').click();

    await expect(card.getByTestId('payment-server-error')).toContainText('more than the');
  });
});
