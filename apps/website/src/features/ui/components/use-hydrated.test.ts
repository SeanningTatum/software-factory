import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Button } from "./button.tsx";
import { SiteFooter } from "./site-footer.tsx";
import { useHydrated } from "./use-hydrated.ts";

function Probe() {
  return createElement("span", null, String(useHydrated()));
}

describe("useHydrated", () => {
  it("is false when rendered on the server", () => {
    expect(renderToString(createElement(Probe))).toBe("<span>false</span>");
  });

  it("keeps a server-rendered Button disabled until hydration", () => {
    const html = renderToString(createElement(Button, { type: "submit" }, "Go"));
    expect(html).toMatch(/<button[^>]* disabled=""/);
  });

  it("keeps the footer's cookie settings button disabled until hydration", () => {
    expect(renderToString(createElement(SiteFooter))).toMatch(/<button[^>]* disabled=""/);
  });
});
