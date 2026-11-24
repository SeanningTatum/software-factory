import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ConsentProvider } from "./consent-banner.tsx";

describe("ConsentProvider before hydration", () => {
  it("renders the banner with its buttons disabled, so an early click is not lost", () => {
    const html = renderToString(
      <ConsentProvider input={{ stored: undefined, optedOut: false }}>
        <p>page</p>
      </ConsentProvider>,
    );
    expect(html).toContain('aria-label="Cookie consent"');
    const buttons = html.match(/<button[^>]*>/g) ?? [];
    expect(buttons).toHaveLength(2);
    for (const button of buttons) expect(button).toContain('disabled=""');
  });
});
