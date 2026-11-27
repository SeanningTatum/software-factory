import { expect, test } from "@playwright/test";
import { signUp } from "#/app/testing/e2e.ts";

test.beforeEach(async ({ page }) => {
  await signUp(page, "E2E Billing");
});

test("@golden checkout: a free user sees an upgrade path or the setup hint", async ({ page }) => {
  await page.goto("/billing");
  await expect(page.getByRole("heading", { name: /Your plan: Free/ })).toBeVisible();
  const upgrade = page.getByRole("button", { name: /Upgrade to/ });
  const hint = page.getByText("Billing isn't set up yet.");
  await expect(upgrade.or(hint).first()).toBeVisible();
});

test("@golden checkout: upgrading leaves for Stripe Checkout", async ({ page }) => {
  await page.goto("/billing");
  await expect(page.getByRole("heading", { name: /Your plan: Free/ })).toBeVisible();
  test.skip(
    await page.getByText("Billing isn't set up yet.").isVisible(),
    "Billing isn't set up: add Stripe test keys to .dev.vars (bun run setup).",
  );
  await page.getByRole("button", { name: /Upgrade to/ }).click();
  await page.waitForURL(/checkout\.stripe\.com/);
});
