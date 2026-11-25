import { expect, test } from "@playwright/test";
import { expectAccessible, signUp } from "#/app/testing/e2e.ts";

test("@golden /dashboard greets a signed-in user and has no serious a11y violation", async ({
  page,
}) => {
  await signUp(page, "E2E Dashboard");
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
  await expectAccessible(page);
});

test("@error /dashboard sends a signed-out visitor to /login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?redirect=%2Fdashboard$/);
});
