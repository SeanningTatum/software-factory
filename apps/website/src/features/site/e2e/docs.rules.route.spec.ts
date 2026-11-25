import { expect, test } from "@playwright/test";
import { expectAccessible } from "#/app/testing/e2e.ts";

test("@golden /docs/rules shows its page and has no serious a11y violation", async ({ page }) => {
  await page.goto("/docs/rules");
  await expect(page.getByRole("heading", { level: 1, name: "Rules and checks" })).toBeVisible();
  await expectAccessible(page);
});

test("@error /docs/rules has no page below it: an unknown path shows the not-found page", async ({
  page,
}) => {
  await page.goto("/docs/rules/no-such-page");
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
});
