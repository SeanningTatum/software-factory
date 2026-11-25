import { expect, test } from "@playwright/test";
import { asVisitor } from "#/app/testing/e2e.ts";

const uniqueEmail = () => `e2e-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;

/**
 * Each test is its own visitor. The sign-up limiter allows 10 attempts a minute per IP; locally every
 * request comes from one address, so without this a second run inside a minute trips it.
 * (On Cloudflare the edge sets this header, so a client can't choose it.)
 */
test.beforeEach(({ page }) => asVisitor(page));

test.beforeEach(async ({ page }) => {
  await page.goto("/signup");
  await expect(page.getByRole("button", { name: "Create account" })).toBeEnabled();
  await page.getByLabel("Name").fill("E2E Billing");
  await page.getByLabel("Email").fill(uniqueEmail());
  await page.getByLabel("Password").fill("correct horse battery");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText("Welcome, E2E Billing")).toBeVisible();
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
