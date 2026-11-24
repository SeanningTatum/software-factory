import { expect, type Page, test } from "@playwright/test";
import { getShortestPaths } from "xstate/graph";
import { credentialsMachine } from "../../src/blocks/auth/ui/credentials.machine.ts";

/**
 * Replays every path through the sign-up form in the browser. Paths come from the machine, so a
 * new state or event shows up here without editing this file.
 */
const paths = getShortestPaths(credentialsMachine, {
  events: [{ type: "SUBMIT", credentials: { email: "", password: "" } }, { type: "EDIT" }],
});

const uniqueEmail = () => `e2e-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;

const fill = async (page: Page, email: string, password: string) => {
  await page.getByLabel("Name").fill("E2E User");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
};

test.describe("sign-up form", () => {
  for (const path of paths) {
    const target = String(path.state.value);
    test(`@golden reaches ${target}`, async ({ page }) => {
      await page.goto("/signup");
      if (target === "done") {
        await fill(page, uniqueEmail(), "correct horse battery");
        await page.getByRole("button", { name: "Create account" }).click();
        await expect(page).toHaveURL(/\/dashboard$/);
        return;
      }
      if (target === "failed" || target === "idle") {
        const email = uniqueEmail();
        await fill(page, email, "correct horse battery");
        await page.getByRole("button", { name: "Create account" }).click();
        await expect(page).toHaveURL(/\/dashboard$/);
        await page.getByRole("button", { name: "Sign out" }).click();
        await page.goto("/signup");
        await fill(page, email, "correct horse battery");
        await page.getByRole("button", { name: "Create account" }).click();
        await expect(page.getByRole("alert")).toBeVisible();
        if (target === "idle") {
          await page.getByLabel("Password").fill("edited password!");
          await expect(page.getByRole("alert")).toBeHidden();
        }
      }
    });
  }
});

test("@error signing in with a wrong password shows an error", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(uniqueEmail());
  await page.getByLabel("Password").fill("not the password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
});
