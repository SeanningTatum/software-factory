import { expect, test } from "@playwright/test";
import { asVisitor, expectAccessible } from "#/app/testing/e2e.ts";

test.beforeEach(({ page }) => asVisitor(page));

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

test("@error /login shows the Turnstile check when the server asks for one, then sends its token", async ({
  page,
}) => {
  const tokens: Array<string | undefined> = [];
  await page.route("**/api/auth/sign-in/email", (route) => {
    const token = route.request().headers()["x-captcha-response"];
    tokens.push(token);
    if (token) return route.continue();
    // What Better Auth answers when the account is past its limit and no token came.
    return route.fulfill({
      status: 400,
      json: { code: "MISSING_RESPONSE", message: "Missing CAPTCHA response" },
    });
  });
  await page.goto("/login");
  const button = page.getByRole("button", { name: "Sign in" });
  await expect(button).toBeEnabled();
  await expect(page.locator("input[name='cf-turnstile-response']")).toHaveCount(0);
  await page.getByLabel("Email").fill("nobody@example.com");
  await page.getByLabel("Password").fill("not the password");
  await button.click();
  await expect(page.getByRole("alert")).toContainText("Complete the check");
  await expect(page.locator("input[name='cf-turnstile-response']")).not.toHaveValue("");
  await expect(button).toBeEnabled();
  await button.click();
  await expect(page.getByRole("alert")).not.toContainText("Complete the check");
  expect(tokens).toEqual([undefined, expect.any(String)]);
  await expectAccessible(page);
});
