import { expect, test } from "@playwright/test";
import { getShortestPaths } from "xstate/graph";
import { mailedCode, signUp } from "#/app/testing/e2e.ts";
import { codeMachine } from "../components/code.machine.ts";

const paths = getShortestPaths(codeMachine, {
  input: {},
  events: [
    { type: "REQUEST", email: "" },
    { type: "CONFIRM", code: "" },
    { type: "RESEND" },
    { type: "EDIT" },
  ],
});
const NEW_PASSWORD = "a brand new secret";

test.describe("password reset by code", () => {
  for (const path of paths) {
    const target = String(path.state.value);
    test(`@golden reaches ${target}`, async ({ page }) => {
      const email = await signUp(page, "E2E Reset");
      await page.getByRole("button", { name: "Sign out" }).click();
      await page.goto("/forgot-password");
      const ask = page.getByRole("button", { name: "Email me a code" });
      await expect(ask).toBeEnabled();
      if (target === "email") return;
      await page.getByLabel("Email").fill(email);
      await ask.click();
      await expect(page.getByLabel("Code")).toBeVisible();
      if (target === "requesting" || target === "code") return;
      await page.getByLabel("Code").fill(await mailedCode(page, email, "Reset your password"));
      await page.getByLabel("New password").fill(NEW_PASSWORD);
      await page.getByRole("button", { name: "Set new password" }).click();
      await expect(page).toHaveURL(/\/login$/);
      await expect(page.getByRole("button", { name: "Sign in" })).toBeEnabled();
      await page.getByLabel("Email").fill(email);
      await page.getByLabel("Password").fill(NEW_PASSWORD);
      await page.getByRole("button", { name: "Sign in" }).click();
      await expect(page).toHaveURL(/\/dashboard$/);
    });
  }
});
