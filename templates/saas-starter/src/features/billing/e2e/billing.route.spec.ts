import { expect, test } from "@playwright/test";
import { expectAccessible, signUp } from "#/app/testing/e2e.ts";

test("@golden /billing shows the plan and has no serious a11y violation", async ({ page }) => {
  await signUp(page, "E2E Plan");
  await page.goto("/billing");
  await expect(page.getByRole("heading", { name: /Your plan: Free/ })).toBeVisible();
  await expectAccessible(page);
});

test("@error /billing sends a signed-out visitor to /login", async ({ page }) => {
  await page.goto("/billing");
  await expect(page).toHaveURL(/\/login\?redirect=%2Fbilling$/);
});
