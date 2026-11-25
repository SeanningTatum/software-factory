import { expect, test } from "@playwright/test";
import { expectAccessible, signUp } from "#/app/testing/e2e.ts";

test("@golden /uploads lists files and has no serious a11y violation", async ({ page }) => {
  await signUp(page, "E2E Files");
  await page.goto("/uploads");
  await expect(page.getByRole("heading", { name: "Files" })).toBeVisible();
  await expect(page.getByText("Nothing uploaded yet.")).toBeVisible();
  await expectAccessible(page);
});

test("@error /uploads sends a signed-out visitor to /login", async ({ page }) => {
  await page.goto("/uploads");
  await expect(page).toHaveURL(/\/login\?redirect=%2Fuploads$/);
});
