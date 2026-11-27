// software-factory-lint allow comments
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

export const expectAccessible = async (page: Page) => {
  const { violations } = await new AxeBuilder({ page }).analyze();
  const serious = violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id}: ${v.help} at ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
  expect(serious).toEqual([]);
};

export const visitor = () => {
  const octet = () => Math.floor(Math.random() * 256);
  return { "cf-connecting-ip": `10.${octet()}.${octet()}.${octet()}` };
};

/**
 * Not `setExtraHTTPHeaders`: that would add the header to Turnstile's cross-origin requests too,
 * which fails their CORS check.
 */
export const asVisitor = (page: Page) =>
  page.route(
    (url) => url.hostname !== "challenges.cloudflare.com",
    (route) => route.continue({ headers: { ...route.request().headers(), ...visitor() } }),
  );

const SENT_MAIL = "/cdn-cgi/local/explorer/api/local/email/sending";

/**
 * The newest code mailed to `email` under `subject`, read from the dev server's simulated
 * mailbox. The subject matters: one address gets a verification mail, then a reset or sign-in one.
 */
export const mailedCode = async (page: Page, email: string, subject: string) => {
  let code: string | undefined;
  await expect(async () => {
    const list = await page.request.get(`${SENT_MAIL}?per_page=100`);
    const { result } = (await list.json()) as {
      result: Array<{ to: Array<string>; subject: string; messageId: string; sentAt: string }>;
    };
    const newest = result
      .filter((mail) => mail.to.includes(email) && mail.subject === subject)
      .sort((a, b) => b.sentAt.localeCompare(a.sentAt))[0];
    expect(newest).toBeDefined();
    const one = await page.request.get(
      `${SENT_MAIL}?email_id=${encodeURIComponent(newest?.messageId ?? "")}`,
    );
    const { result: mail } = (await one.json()) as { result: { text: string } };
    code = /\b\d{8}\b/.exec(mail.text)?.[0];
    expect(code).toBeDefined();
  }).toPass();
  return code ?? "";
};

/** After a sign-up: with the email feature on, the new account must enter its mailed code first. */
export const passVerification = async (page: Page, email: string) => {
  await expect(page).toHaveURL(/\/(dashboard|verify-email)/);
  if (!page.url().includes("/verify-email")) return;
  await page.getByLabel("Code").fill(await mailedCode(page, email, "Confirm your email address"));
  await page.getByRole("button", { name: "Verify" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
};

export const uniqueEmail = () =>
  `e2e-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;

export const signUp = async (page: Page, name = "E2E User") => {
  await asVisitor(page);
  const email = uniqueEmail();
  await page.goto("/signup");
  await expect(page.getByRole("button", { name: "Create account" })).toBeEnabled();
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("correct horse battery");
  await page.getByRole("button", { name: "Create account" }).click();
  await passVerification(page, email);
  await expect(page.getByText(`Welcome, ${name}`)).toBeVisible();
  return email;
};
