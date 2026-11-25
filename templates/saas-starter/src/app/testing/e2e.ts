import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

/** Fails when axe finds a serious or critical accessibility violation on the page as it is now. */
export const expectAccessible = async (page: Page) => {
  const { violations } = await new AxeBuilder({ page }).analyze();
  const serious = violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id}: ${v.help} at ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
  expect(serious).toEqual([]);
};

/**
 * A made-up client address for one visitor. The rate limiters count per IP and every local request
 * comes from one address, so without this a second run inside a minute trips them. (On Cloudflare
 * the edge sets this header, so a client can't choose it.)
 */
export const visitor = () => {
  const octet = () => Math.floor(Math.random() * 256);
  return { "cf-connecting-ip": `10.${octet()}.${octet()}.${octet()}` };
};

/** Signs a new visitor up through the /signup page (needs the `auth` feature) and waits for the dashboard. */
export const signUp = async (page: Page, name = "E2E User") => {
  await page.setExtraHTTPHeaders(visitor());
  await page.goto("/signup");
  await expect(page.getByRole("button", { name: "Create account" })).toBeEnabled();
  await page.getByLabel("Name").fill(name);
  await page
    .getByLabel("Email")
    .fill(`e2e-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`);
  await page.getByLabel("Password").fill("correct horse battery");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText(`Welcome, ${name}`)).toBeVisible();
};
