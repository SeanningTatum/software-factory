import { expect, test } from "@playwright/test";
import { expectAccessible, visitor } from "#/app/testing/e2e.ts";

test.beforeEach(({ page }) => page.setExtraHTTPHeaders(visitor()));

test("@golden /login shows the sign-in form and has no serious a11y violation", async ({
  page,
}) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeEnabled();
  await expectAccessible(page);
});

test("@error /login shows an error for a wrong password", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("button", { name: "Sign in" })).toBeEnabled();
  await page.getByLabel("Email").fill("nobody@example.com");
  await page.getByLabel("Password").fill("not the password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expectAccessible(page);
});
