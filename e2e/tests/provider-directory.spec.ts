import { expect, test } from './support/fixtures';

test.describe('provider directory', () => {
  test('lists every seeded provider and searches by specialty', async ({ page, api }) => {
    const providers = await api.providers();

    await page.goto('/providers');
    await expect(page.locator('.provider-card')).toHaveCount(providers.length);

    await page.getByTestId('provider-search').fill('dermatology');
    await expect(page.locator('.provider-card')).toHaveCount(
      providers.filter((provider) => provider.specialty === 'Dermatology').length,
    );
  });

  test('opens a provider profile and renders its bio', async ({ page, api }) => {
    const providers = await api.providers();
    const target = providers[0];

    await page.goto('/providers');
    await page.getByTestId(`provider-card-${target.id}`).click();

    await expect(page).toHaveURL(new RegExp(`/providers/${target.id}$`));
    await expect(page.getByTestId('provider-profile')).toContainText(target.name);
    await expect(page.getByTestId('provider-bio')).toBeVisible();
  });

  test('an unknown provider id shows the not-found error', async ({ page }) => {
    await page.goto('/providers/prv_does_not_exist');

    await expect(page.getByTestId('alert-banner')).toContainText('We could not find that provider.');
  });
});
