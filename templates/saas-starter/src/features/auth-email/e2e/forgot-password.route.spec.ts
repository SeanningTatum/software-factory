import { expect, test } from "@playwright/test";
import { asVisitor, expectAccessible } from "#/app/testing/e2e.ts";

test.beforeEach(({ page }) => asVisitor(page));

test("@golden /forgot-password is linked from the sign-in page and has no serious a11y violation", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByRole("link", { name: "Forgot password?" }).click();
  await expect(page.getByRole("heading", { name: "Reset your password" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Email me a code" })).toBeEnabled();
  await expectAccessible(page);
});

test("@error /forgot-password answers an unknown address like a known one, then refuses the code", async ({
  page,
}) => {
  await page.goto("/forgot-password");
  await expect(page.getByRole("button", { name: "Email me a code" })).toBeEnabled();
  await page.getByLabel("Email").fill("nobody@example.com");
  await page.getByRole("button", { name: "Email me a code" }).click();
  await page.getByLabel("Code").fill("00000000");
  await page.getByLabel("New password").fill("a brand new secret");
  await page.getByRole("button", { name: "Set new password" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expectAccessible(page);
});
