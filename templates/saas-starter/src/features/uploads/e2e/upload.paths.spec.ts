import { expect, test } from "@playwright/test";
import { asVisitor } from "#/app/testing/e2e.ts";

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
const uniqueEmail = () => `e2e-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;

test.beforeEach(({ page }) => asVisitor(page));

test.beforeEach(async ({ page }) => {
  await page.goto("/signup");
  await expect(page.getByRole("button", { name: "Create account" })).toBeEnabled();
  await page.getByLabel("Name").fill("E2E Uploads");
  await page.getByLabel("Email").fill(uniqueEmail());
  await page.getByLabel("Password").fill("correct horse battery");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText("Welcome, E2E Uploads")).toBeVisible();
  await page.goto("/uploads");
  await expect(page.getByLabel("Upload a file")).toBeEnabled();
});

test("@golden upload: a PNG is stored and listed", async ({ page }) => {
  await page
    .getByLabel("Upload a file")
    .setInputFiles({ name: "cat.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByText("Uploaded.")).toBeVisible();
  await expect(page.getByRole("link", { name: "cat.png" })).toBeVisible();
});

test("@error upload: an unsupported file is rejected before upload", async ({ page }) => {
  await page
    .getByLabel("Upload a file")
    .setInputFiles({ name: "a.html", mimeType: "text/html", buffer: Buffer.from("<p>") });
  await expect(page.getByRole("alert")).toHaveText("Upload a PNG, JPEG, GIF, WebP or PDF.");
});

test("@error upload: a file whose bytes lie about its type is refused by the server", async ({
  page,
}) => {
  await page
    .getByLabel("Upload a file")
    .setInputFiles({ name: "fake.png", mimeType: "image/png", buffer: Buffer.from("<html>") });
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
});
