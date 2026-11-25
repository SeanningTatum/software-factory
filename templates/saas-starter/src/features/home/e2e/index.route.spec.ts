import { expect, test } from "@playwright/test";
import { expectAccessible } from "#/app/testing/e2e.ts";

test("@golden / shows the landing page and has no serious a11y violation", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expectAccessible(page);
});

test("@error an unknown path shows the not-found page", async ({ page }) => {
  await page.goto("/no-such-page");
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await expectAccessible(page);
});
