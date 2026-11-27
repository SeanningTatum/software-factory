import { expect, type Page, test } from "@playwright/test";
import { getShortestPaths } from "xstate/graph";
import { asVisitor, passVerification, uniqueEmail } from "#/app/testing/e2e.ts";
import { credentialsMachine } from "../components/credentials.machine.ts";

const paths = getShortestPaths(credentialsMachine, {
  events: [{ type: "SUBMIT", credentials: { email: "", password: "" } }, { type: "EDIT" }],
});

test.beforeEach(({ page }) => asVisitor(page));

const fill = async (page: Page, email: string, password: string) => {
  await expect(page.getByRole("button", { name: "Create account" })).toBeEnabled();
  await page.getByLabel("Name").fill("E2E User");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
};

test.describe("credentials form", () => {
  for (const path of paths) {
    const target = String(path.state.value);
    test(`@golden reaches ${target}`, async ({ page }) => {
      await page.goto("/signup");
      if (target === "done" || target === "submitting") {
        const email = uniqueEmail();
        await fill(page, email, "correct horse battery");
        await page.getByRole("button", { name: "Create account" }).click();
        await passVerification(page, email);
        return;
      }
      if (target === "failed" || target === "idle") {
        await page.goto("/login");
        await expect(page.getByRole("button", { name: "Sign in" })).toBeEnabled();
        await page.getByLabel("Email").fill(uniqueEmail());
        await page.getByLabel("Password").fill("not the password");
        await page.getByRole("button", { name: "Sign in" }).click();
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
  await expect(page.getByRole("button", { name: "Sign in" })).toBeEnabled();
  await page.getByLabel("Email").fill(uniqueEmail());
  await page.getByLabel("Password").fill("not the password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
});
