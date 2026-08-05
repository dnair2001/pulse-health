import { IMPLEMENTATIONS, expect, test } from './support/fixtures';
import {
  appointmentCards,
  chooseProvider,
  chooseSlot,
  gotoAppointmentList,
  gotoSchedulePage,
  slotDayHeadings,
  waitForListSettled,
} from './support/pages';

const PROVIDER_ID = 'prv_001';

for (const { name, basePath } of IMPLEMENTATIONS) {
  test.describe(`${name}: scheduling`, () => {
    test('books an appointment and lands back on the list with it present', async ({
      api,
      page,
    }) => {
      const providers = await api.providers();
      const visitTypes = await api.visitTypes();
      const before = await api.appointments('upcoming');
      const slots = await api.slots(PROVIDER_ID);
      expect(slots.length, 'seed data should offer open slots').toBeGreaterThan(0);
      const slot = slots[0];

      await gotoAppointmentList(page, basePath);
      await page.getByTestId('schedule-cta').click();

      await expect(page.getByRole('heading', { name: 'Schedule an appointment' })).toBeVisible();
      await expect(page).toHaveURL(new RegExp(`${basePath}/appointments/schedule$`));

      await gotoSchedulePage(page, basePath, providers.length);
      await chooseProvider(page, PROVIDER_ID);

      // Slots are grouped under one heading per calendar day, so a provider with availability
      // spread over several days must render several groups.
      const dayCount = new Set(slots.map((each) => each.startsAt.slice(0, 10))).size;
      await expect(slotDayHeadings(page)).toHaveCount(dayCount);

      await chooseSlot(page, slot.id);
      await page.getByTestId('visit-type-select').selectOption(visitTypes[0].id);
      await page.getByTestId('reason-input').fill('Playwright end-to-end booking');

      await page.getByTestId('submit-appointment').click();

      await expect(page).toHaveURL(new RegExp(`${basePath}/appointments$`));
      await expect(page.getByTestId('alert-banner')).toContainText('Appointment scheduled.');
      await waitForListSettled(page);

      const after = await api.appointments('upcoming');
      expect(after.length).toBe(before.length + 1);
      const created = after.find((appointment) => appointment.slotId === slot.id);
      expect(created, 'the API should hold an appointment for the chosen slot').toBeTruthy();

      const card = page.getByTestId(`appointment-${created!.id}`);
      await expect(card).toBeVisible();
      await expect(card).toContainText('Playwright end-to-end booking');
      await expect(card).toContainText(created!.provider.name);
      await expect(appointmentCards(page)).toHaveCount(after.length);
    });

    test('a submit with no reason shows a field error and does not navigate', async ({
      api,
      page,
    }) => {
      const providers = await api.providers();
      const visitTypes = await api.visitTypes();
      const slots = await api.slots(PROVIDER_ID);
      const before = await api.appointments();

      await gotoSchedulePage(page, basePath, providers.length);
      await chooseProvider(page, PROVIDER_ID);
      await chooseSlot(page, slots[0].id);
      await page.getByTestId('visit-type-select').selectOption(visitTypes[0].id);
      // Reason deliberately left blank.

      await page.getByTestId('submit-appointment').click();

      await expect(page.getByTestId('reason-error')).toHaveText(
        'A reason for the visit is required.',
      );
      await expect(page).toHaveURL(new RegExp(`${basePath}/appointments/schedule$`));
      expect((await api.appointments()).length).toBe(before.length);
    });

    test('an empty submit reports every missing field', async ({ api, page }) => {
      const providers = await api.providers();

      await gotoSchedulePage(page, basePath, providers.length);
      await page.getByTestId('submit-appointment').click();

      await expect(page.getByTestId('slot-error')).toHaveText('Please choose a time slot.');
      await expect(page.getByTestId('reason-error')).toHaveText(
        'A reason for the visit is required.',
      );
      await expect(
        page.locator('.field__error', { hasText: 'Please choose a provider.' }),
      ).toBeVisible();
      await expect(
        page.locator('.field__error', { hasText: 'Please choose a visit type.' }),
      ).toBeVisible();
      await expect(page).toHaveURL(new RegExp(`${basePath}/appointments/schedule$`));
    });
  });
}
