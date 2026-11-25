import { expect, test } from "@playwright/test";
import { expectAccessible } from "#/app/testing/e2e.ts";

test("@golden the /docs layout lists every docs page and has no serious a11y violation", async ({
  page,
}) => {
  await page.goto("/docs");
  const nav = page.getByRole("navigation", { name: "Docs" });
  await expect(nav.getByRole("link")).toHaveCount(5);
  await nav.getByRole("link", { name: "Deploying" }).click();
  await expect(page).toHaveURL(/\/docs\/setup$/);
  await expectAccessible(page);
});

test("@error an unknown docs page shows the not-found page", async ({ page }) => {
  await page.goto("/docs/no-such-page");
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
});
