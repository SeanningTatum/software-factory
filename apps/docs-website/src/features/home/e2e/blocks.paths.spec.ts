import { expect, test } from "@playwright/test";
import { getShortestPaths } from "xstate/graph";
import { blocksMachine } from "../components/blocks.machine.ts";
import { commandFor } from "../lib/blocks.ts";

test.use({ permissions: ["clipboard-read", "clipboard-write"] });

const paths = getShortestPaths(blocksMachine, {
  events: [{ type: "TOGGLE", name: "billing" }, { type: "TOGGLE", name: "db" }, { type: "COPY" }],
});

const steps: Record<
  string,
  (page: import("@playwright/test").Page, name: string) => Promise<void>
> = {
  TOGGLE: (page, name) => page.getByRole("button", { name, exact: true }).first().click(),
  COPY: (page) => page.getByRole("button", { name: "Copy" }).first().click(),
};

for (const path of paths) {
  const events = path.steps.map((step) => step.event).filter((event) => event.type in steps);
  const told = events.map((event) => ("name" in event ? event.name : "copy")).join(" → ");
  const command = commandFor(path.state.context.picked);
  test(`@golden blocks: ${told || "first visit"} gives "${command}"`, async ({ page }) => {
    await page.goto("/");
    for (const event of events) await steps[event.type]?.(page, "name" in event ? event.name : "");
    await expect(page.locator("code", { hasText: "create-software-factory" }).first()).toHaveText(
      command,
    );
    if (path.state.value !== "copying") return;
    await expect(page.getByRole("button", { name: "Copied" }).first()).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(command);
  });
}
