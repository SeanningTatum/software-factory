import { expect, test } from "@playwright/test";

const uniqueEmail = () => `e2e-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;

test.beforeEach(async ({ page }) => {
  await page.goto("/signup");
  await page.getByLabel("Name").fill("E2E Billing");
  await page.getByLabel("Email").fill(uniqueEmail());
  await page.getByLabel("Password").fill("correct horse battery");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("@golden checkout: a free user sees an upgrade path or the setup hint", async ({ page }) => {
  await page.goto("/billing");
  await expect(page.getByRole("heading", { name: /Your plan: Free/ })).toBeVisible();
  const upgrade = page.getByRole("button", { name: /Upgrade to/ });
  const hint = page.getByText("Billing isn't set up yet.");
  await expect(upgrade.or(hint).first()).toBeVisible();
});

test("@golden checkout: upgrading leaves for Stripe Checkout", async ({ page }) => {
  test.skip(!process.env.STRIPE_SECRET_KEY, "needs Stripe test keys in .dev.vars");
  await page.goto("/billing");
  await page.getByRole("button", { name: /Upgrade to/ }).click();
  await page.waitForURL(/checkout\.stripe\.com/);
});
