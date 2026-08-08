import { expect, test } from './support/fixtures';

test.describe('patient profile', () => {
  test('shows the demographics on file with the SSN masked', async ({ page }) => {
    await page.goto('/profile');

    await expect(page.getByTestId('patient-profile')).toContainText('Jordan Reyes');
    await expect(page.getByTestId('profile-ssn')).toContainText('6789');
    await expect(page.getByTestId('profile-ssn')).not.toContainText('231-45-6789');
  });

  test('edits and saves contact details', async ({ page }) => {
    await page.goto('/profile');
    await page.getByTestId('edit-profile').click();

    await page.getByTestId('email-input').fill('jordan.updated@example.com');
    await page.getByTestId('save-profile').click();

    await expect(page.getByTestId('profile-email')).toContainText('jordan.updated@example.com');
  });

  test('verifies identity with the matching SSN and date of birth', async ({ page }) => {
    await page.goto('/profile');

    await page.getByTestId('verify-ssn-input').fill('231-45-6789');
    await page.getByTestId('verify-dob-input').fill('1985-06-12');
    await page.getByTestId('verify-identity').click();

    await expect(page.getByTestId('insurance-member-id')).toContainText('PHX-88213045');
  });

  test('rejects verification with a non-matching SSN', async ({ page }) => {
    await page.goto('/profile');

    await page.getByTestId('verify-ssn-input').fill('000-00-0000');
    await page.getByTestId('verify-dob-input').fill('1985-06-12');
    await page.getByTestId('verify-identity').click();

    await expect(page.getByTestId('alert-banner')).toContainText(
      'We could not verify your identity',
    );
  });
});
