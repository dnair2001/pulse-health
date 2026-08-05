import { IMPLEMENTATIONS, expect, test } from './support/fixtures';
import { chooseProvider, chooseSlot, gotoSchedulePage } from './support/pages';

const PROVIDER_ID = 'prv_001';

/**
 * AGENTS.md invariant 2: business rules live server-side and the frontends only surface the
 * typed error codes the API returns. Double-booking is the case that proves it — a client-side
 * guard cannot see a slot another patient took after this page loaded, so the only way the user
 * learns about it is `SLOT_ALREADY_BOOKED` (409, `field: "slotId"`) coming back from
 * `POST /api/appointments` and being rendered.
 */
for (const { name, basePath } of IMPLEMENTATIONS) {
  test.describe(`${name}: server-authoritative rules`, () => {
    test('a slot taken after page load surfaces the server error and blocks the booking', async ({
      api,
      page,
    }) => {
      const providers = await api.providers();
      const visitTypes = await api.visitTypes();
      const slots = await api.slots(PROVIDER_ID);
      expect(slots.length).toBeGreaterThan(0);
      const contestedSlot = slots[0];

      await gotoSchedulePage(page, basePath, providers.length);
      await chooseProvider(page, PROVIDER_ID);
      await chooseSlot(page, contestedSlot.id);
      await page.getByTestId('visit-type-select').selectOption(visitTypes[0].id);
      await page.getByTestId('reason-input').fill('Double booking race');

      // Another patient books the same slot while this form sits open. The browser has no way
      // to know, which is the whole point: only the server can reject this.
      const other = await api.schedule({
        providerId: PROVIDER_ID,
        slotId: contestedSlot.id,
        visitType: visitTypes[0].id,
        reason: 'Booked by another patient',
      });
      expect(other.slotId).toBe(contestedSlot.id);

      const appointmentsBefore = await api.appointments();

      await page.getByTestId('submit-appointment').click();

      const serverMessage = 'That time slot has just been taken. Please pick another.';
      await expect(page.getByTestId('slot-server-error')).toHaveText(serverMessage);
      await expect(page.getByTestId('alert-banner')).toContainText(serverMessage);

      // Still on the form, and the server refused to create a second appointment.
      await expect(page).toHaveURL(new RegExp(`${basePath}/appointments/schedule$`));
      expect((await api.appointments()).length).toBe(appointmentsBefore.length);

      // The contested slot is dropped from the selection so the user has to pick again.
      await expect(page.getByTestId(`slot-${contestedSlot.id}`)).toHaveCount(0);
    });
  });
}
