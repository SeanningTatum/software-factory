import { expect, test } from "@playwright/test";
import { expectAccessible } from "#/app/testing/e2e.ts";

test("@golden /docs shows the first page with its sidebar", async ({ page }) => {
  await page.goto("/docs");
  await expect(page.getByRole("heading", { level: 1, name: "Getting started" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Features" }).first()).toBeVisible();
  await expectAccessible(page);
});

test("@error a docs path with no page shows the not-found page", async ({ page }) => {
  const response = await page.goto("/docs/no-such-page");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
});
