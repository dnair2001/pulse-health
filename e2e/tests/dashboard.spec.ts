import { expect, test } from './support/fixtures';

test.describe('dashboard', () => {
  test('greets the patient and summarizes every domain', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('.page__title')).toContainText('Jordan Reyes');
    await expect(page.getByTestId('next-appointment-card')).toContainText('Annual physical');
    await expect(page.getByTestId('prescriptions-card')).toBeVisible();
    await expect(page.getByTestId('billing-card')).toBeVisible();
    await expect(page.getByTestId('providers-card')).toBeVisible();
  });

  test('the billing card total balance leads to the billing page', async ({ page }) => {
    await page.goto('/');

    await page.getByTestId('billing-card').getByRole('link', { name: 'View billing' }).click();

    await expect(page).toHaveURL(/\/billing$/);
    await expect(page.locator('.invoice')).toHaveCount(5);
  });

  test('the shell nav Dashboard link returns from another page', async ({ page }) => {
    await page.goto('/prescriptions');

    await page.getByRole('link', { name: 'Dashboard' }).click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId('next-appointment-card')).toBeVisible();
  });
});
