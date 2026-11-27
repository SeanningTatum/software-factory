import { expect, test } from "@playwright/test";
import { getShortestPaths } from "xstate/graph";
import { consentMachine } from "../components/consent.machine.ts";

const paths = getShortestPaths(consentMachine, {
  input: { stored: undefined, optedOut: false },
  events: [{ type: "ACCEPT" }, { type: "DECLINE" }, { type: "REOPEN" }],
});

const steps: Record<string, (page: import("@playwright/test").Page) => Promise<void>> = {
  ACCEPT: (page) => page.getByRole("button", { name: "Allow" }).click(),
  DECLINE: (page) => page.getByRole("button", { name: "No thanks" }).click(),
  REOPEN: (page) => page.getByRole("button", { name: "Cookie settings" }).click(),
};

const banner = (page: import("@playwright/test").Page) =>
  page.getByRole("dialog", { name: "Cookie consent" });

for (const path of paths) {
  const events = path.steps.map((s) => s.event.type).filter((t) => t in steps);
  test(`@golden consent: ${events.join(" → ") || "first visit"} ends ${String(path.state.value)}`, async ({
    page,
  }) => {
    await page.goto("/");
    for (const type of events) await steps[type]?.(page);
    if (path.state.value === "asking") await expect(banner(page)).toBeVisible();
    else await expect(banner(page)).toBeHidden();
  });
}

test("@golden consent: Global Privacy Control hides the banner", async ({ browser }) => {
  const context = await browser.newContext({ extraHTTPHeaders: { "sec-gpc": "1" } });
  const page = await context.newPage();
  await page.goto("/");
  await expect(banner(page)).toBeHidden();
  await context.close();
});

test("consent: allowing analytics gives an anonymous id, declining removes it", async ({
  page,
}) => {
  const aid = async () =>
    (await page.context().cookies()).find((cookie) => cookie.name === "aid")?.value;
  await page.goto("/");
  await steps.ACCEPT?.(page);
  await expect.poll(aid).toMatch(/^[0-9a-f-]{36}$/);
  await steps.REOPEN?.(page);
  await steps.DECLINE?.(page);
  await expect.poll(aid).toBeUndefined();
});
