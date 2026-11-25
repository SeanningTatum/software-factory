import { expect, test } from "@playwright/test";
import { expectAccessible } from "#/app/testing/e2e.ts";

test("@golden /docs shows its page and has no serious a11y violation", async ({ page }) => {
  await page.goto("/docs");
  await expect(page.getByRole("heading", { level: 1, name: "Getting started" })).toBeVisible();
  await expectAccessible(page);
});

test("@error /docs has no page below it: an unknown path shows the not-found page", async ({
  page,
}) => {
  await page.goto("/docs/no-such-page");
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
});
