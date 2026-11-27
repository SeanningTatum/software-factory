import { expect, test } from "@playwright/test";
import { asVisitor, expectAccessible } from "#/app/testing/e2e.ts";

test.beforeEach(({ page }) => asVisitor(page));

test("@golden /signup shows the sign-up form and has no serious a11y violation", async ({
  page,
}) => {
  await page.goto("/signup");
  await expect(page.getByRole("button", { name: "Create account" })).toBeEnabled();
  await expectAccessible(page);
});

test("@golden /signup shows the Turnstile check and turns the button on once it passes", async ({
  page,
}) => {
  await page.goto("/signup");
  await expect(page.getByRole("button", { name: "Create account" })).toBeEnabled();
  await expect(page.locator("input[name='cf-turnstile-response']")).not.toHaveValue("");
});

test("@error /signup keeps a too-short password on the page", async ({ page }) => {
  await page.goto("/signup");
  await expect(page.getByRole("button", { name: "Create account" })).toBeEnabled();
  await page.getByLabel("Name").fill("Short Pass");
  await page.getByLabel("Email").fill("short@example.com");
  await page.getByLabel("Password").fill("short");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/signup$/);
  await expect(page.getByLabel("Password")).toHaveJSProperty("validity.tooShort", true);
});
