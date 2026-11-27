import { expect, test } from "@playwright/test";
import { asVisitor, expectAccessible, signUp } from "#/app/testing/e2e.ts";

test("@golden /verify-email lets a new account in once it enters its mailed code", async ({
  page,
}) => {
  await signUp(page, "E2E Verify");
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("@error /verify-email refuses a wrong code and has no serious a11y violation", async ({
  page,
}) => {
  await asVisitor(page);
  await page.goto("/verify-email?email=nobody%40example.com");
  await expect(page.getByRole("button", { name: "Verify" })).toBeEnabled();
  await page.getByLabel("Code").fill("000000");
  await page.getByRole("button", { name: "Verify" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expectAccessible(page);
});
