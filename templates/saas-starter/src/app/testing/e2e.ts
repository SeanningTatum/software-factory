import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

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

/**
 * Makes every request the page sends to this app come from a new visitor. Not `setExtraHTTPHeaders`:
 * that would add the header to Turnstile's cross-origin requests too, which fails their CORS check.
 */
export const asVisitor = (page: Page) =>
  page.route(
    (url) => url.hostname !== "challenges.cloudflare.com",
    (route) => route.continue({ headers: { ...route.request().headers(), ...visitor() } }),
  );

export const signUp = async (page: Page, name = "E2E User") => {
  await asVisitor(page);
  await page.goto("/signup");
  // With Turnstile keys set the button stays off until the check hands over its token, so this
  // also waits for the token (Cloudflare's test keys solve it on their own).
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
