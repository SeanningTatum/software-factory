import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SiteFooter } from "#/features/core/ui/components/site-footer.tsx";
import { CookieSettingsButton } from "./cookie-settings.tsx";

describe("CookieSettingsButton", () => {
  it("stays disabled until hydration, inside the site footer", () => {
    const html = renderToString(
      createElement(SiteFooter, null, createElement(CookieSettingsButton)),
    );
    expect(html).toMatch(/<button[^>]* disabled=""[^>]*>Cookie settings<\/button>/);
  });
});
