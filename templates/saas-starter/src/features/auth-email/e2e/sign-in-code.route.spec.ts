import { expect, test } from "@playwright/test";
import { asVisitor, expectAccessible, mailedCode, signUp } from "#/app/testing/e2e.ts";

test("@golden /sign-in-code signs a user in with the mailed code", async ({ page }) => {
  const email = await signUp(page, "E2E Code");
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.goto("/login");
  await page.getByRole("link", { name: "Email me a sign-in code" }).click();
  await expect(page.getByRole("button", { name: "Email me a code" })).toBeEnabled();
  await expectAccessible(page);
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a code" }).click();
  await expect(page.getByLabel("Code")).toBeVisible();
  await page.getByLabel("Code").fill(await mailedCode(page, email, "Your sign-in code"));
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText("Welcome, E2E Code")).toBeVisible();
});

test("@error /sign-in-code refuses a wrong code", async ({ page }) => {
  await asVisitor(page);
  await page.goto("/sign-in-code");
  await expect(page.getByRole("button", { name: "Email me a code" })).toBeEnabled();
  await page.getByLabel("Email").fill("nobody@example.com");
  await page.getByRole("button", { name: "Email me a code" }).click();
  await page.getByLabel("Code").fill("000000");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
});
