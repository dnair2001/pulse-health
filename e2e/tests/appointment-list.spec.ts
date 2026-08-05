import { IMPLEMENTATIONS, expect, test } from './support/fixtures';
import { appointmentCards, gotoAppointmentList, waitForListSettled } from './support/pages';

/**
 * Every flow runs once per frontend. Expectations are derived from the API rather than written
 * as literals, because seed appointments are generated relative to now and drift across days.
 */
for (const { name, basePath } of IMPLEMENTATIONS) {
  test.describe(`${name}: appointments list`, () => {
    test('renders the upcoming appointments the API reports', async ({ api, page }) => {
      const upcoming = await api.appointments('upcoming');
      expect(upcoming.length, 'seed data should contain upcoming appointments').toBeGreaterThan(0);

      await gotoAppointmentList(page, basePath);

      await expect(page.getByRole('heading', { name: 'Your appointments' })).toBeVisible();
      await expect(appointmentCards(page)).toHaveCount(upcoming.length);

      for (const appointment of upcoming) {
        const card = page.getByTestId(`appointment-${appointment.id}`);
        await expect(card).toBeVisible();
        await expect(card).toContainText(appointment.provider.name);
        await expect(card).toContainText(appointment.reason);
      }
    });

    test('switching to the Past tab shows past appointments instead', async ({ api, page }) => {
      const upcoming = await api.appointments('upcoming');
      const past = await api.appointments('past');
      expect(past.length, 'seed data should contain past appointments').toBeGreaterThan(0);

      await gotoAppointmentList(page, basePath);

      await page.getByTestId('tab-past').click();
      await waitForListSettled(page);

      await expect(page.getByTestId('tab-past')).toHaveAttribute('aria-selected', 'true');
      await expect(appointmentCards(page)).toHaveCount(past.length);
      for (const appointment of past) {
        await expect(page.getByTestId(`appointment-${appointment.id}`)).toBeVisible();
      }
      for (const appointment of upcoming) {
        await expect(page.getByTestId(`appointment-${appointment.id}`)).toHaveCount(0);
      }

      await page.getByTestId('tab-upcoming').click();
      await waitForListSettled(page);
      await expect(appointmentCards(page)).toHaveCount(upcoming.length);
    });

    test('the visit-type filter narrows the list and Clear filters restores it', async ({
      api,
      page,
    }) => {
      const upcoming = await api.appointments('upcoming');
      const visitType = upcoming[0].visitType;
      const matching = upcoming.filter((appointment) => appointment.visitType === visitType);
      expect(
        matching.length,
        'the filter has to remove something for this test to mean anything',
      ).toBeLessThan(upcoming.length);

      await gotoAppointmentList(page, basePath);

      await page.getByTestId('filter-visit-type').selectOption(visitType);
      await waitForListSettled(page);
      await expect(appointmentCards(page)).toHaveCount(matching.length);
      for (const appointment of matching) {
        await expect(page.getByTestId(`appointment-${appointment.id}`)).toBeVisible();
      }

      await page.getByTestId('filter-reset').click();
      await waitForListSettled(page);
      await expect(appointmentCards(page)).toHaveCount(upcoming.length);
    });

    test('a filter with no matches shows the filtered empty state', async ({ page }) => {
      await gotoAppointmentList(page, basePath);

      // Nothing upcoming can be cancelled-and-upcoming at once: `scope=upcoming` only ever
      // returns scheduled appointments, so this combination is reliably empty.
      await page.getByTestId('filter-status').selectOption('cancelled');

      await expect(page.getByTestId('empty-state')).toBeVisible();
      await expect(page.getByTestId('empty-state')).toContainText(
        'No appointments match these filters',
      );
      await expect(appointmentCards(page)).toHaveCount(0);
    });

    test('cancelling an appointment moves it to Past with a Cancelled badge', async ({
      api,
      page,
    }) => {
      const upcoming = await api.appointments('upcoming');
      const target = upcoming.find((appointment) => appointment.cancellable);
      expect(target, 'seed data should contain a cancellable appointment').toBeTruthy();
      const appointmentId = target!.id;

      await gotoAppointmentList(page, basePath);

      await page.getByTestId(`cancel-${appointmentId}`).click();

      const dialog = page.getByTestId('confirm-dialog');
      await expect(dialog).toBeVisible();
      await expect(dialog).toContainText('Cancel this appointment?');
      await expect(dialog).toContainText(target!.provider.name);

      await page.getByTestId('confirm-accept').click();

      await expect(page.getByTestId('confirm-dialog')).toHaveCount(0);
      await expect(page.getByTestId('alert-banner')).toContainText('Appointment cancelled.');
      await expect(page.getByTestId(`appointment-${appointmentId}`)).toHaveCount(0);
      await expect(appointmentCards(page)).toHaveCount(upcoming.length - 1);

      await page.getByTestId('tab-past').click();
      await waitForListSettled(page);
      const card = page.getByTestId(`appointment-${appointmentId}`);
      await expect(card).toBeVisible();
      await expect(card.locator('[data-status="cancelled"]')).toHaveText('Cancelled');
      await expect(card.getByTestId('cancel-blocked')).toHaveText(
        'This appointment is already cancelled.',
      );

      // The server, not the UI, is the source of truth for the new status.
      const after = await api.appointments();
      expect(after.find((appointment) => appointment.id === appointmentId)?.status).toBe(
        'cancelled',
      );
    });

    test('dismissing the confirmation dialog leaves the appointment alone', async ({
      api,
      page,
    }) => {
      const upcoming = await api.appointments('upcoming');
      const appointmentId = upcoming.find((appointment) => appointment.cancellable)!.id;

      await gotoAppointmentList(page, basePath);
      await page.getByTestId(`cancel-${appointmentId}`).click();
      await expect(page.getByTestId('confirm-dialog')).toBeVisible();

      await page.getByTestId('confirm-cancel').click();

      await expect(page.getByTestId('confirm-dialog')).toHaveCount(0);
      await expect(page.getByTestId(`appointment-${appointmentId}`)).toBeVisible();
      await expect(appointmentCards(page)).toHaveCount(upcoming.length);
      expect(
        (await api.appointments()).find((appointment) => appointment.id === appointmentId)?.status,
      ).toBe('scheduled');
    });
  });
}
