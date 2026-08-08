import { expect, test } from './support/fixtures';

test.describe('prescriptions', () => {
  test('lists every seeded prescription and filters by status', async ({ page }) => {
    await page.goto('/prescriptions');

    await expect(page.locator('.prescription')).toHaveCount(5);

    await page.getByTestId('tab-completed').click();
    await expect(page.locator('.prescription')).toHaveCount(1);
  });

  test('requests a refill and decrements the count shown', async ({ page }) => {
    await page.goto('/prescriptions');

    const card = page.getByTestId('prescription-card-rx_001');
    const before = await card.getByTestId('refills-remaining').textContent();

    await card.getByTestId('refill-rx_001').click();

    await expect(page.getByTestId('alert-banner')).toContainText('refill requested');
    await expect(card.getByTestId('refills-remaining')).not.toHaveText(before ?? '');
  });

  test('disables the refill action once there are no refills left', async ({ page }) => {
    await page.goto('/prescriptions');

    // rx_002 (Metformin) is seeded with 0 refills remaining.
    const card = page.getByTestId('prescription-card-rx_002');
    await expect(card.getByTestId('refill-rx_002')).toBeDisabled();
  });
});
