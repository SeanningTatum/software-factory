import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { APP_NAME } from "#/app/constants.ts";
import { MailButton, MailCode, MailLayout, MailText } from "../components/mail.tsx";
import { renderMail } from "./render.ts";

const mail = createElement(
  MailLayout,
  {
    preview: "Your invoice is ready",
    heading: "Invoice 42",
    footer: "You get this as a customer.",
  },
  createElement(MailText, null, "Thanks for your order."),
  createElement(MailCode, null, "48201739"),
  createElement(MailButton, { href: "https://example.com/invoices/42" }, "View invoice"),
);

describe("renderMail", () => {
  it("gives a whole HTML document in the shared layout", () => {
    const { html } = renderMail(mail);
    expect(html).toMatch(/^<!DOCTYPE html/);
    expect(html).toContain(APP_NAME);
    expect(html).toContain("Invoice 42");
    expect(html).toContain('href="https://example.com/invoices/42"');
  });

  it("gives a text part with the same words, the link, and no markup", () => {
    const { text } = renderMail(mail);
    expect(text).toContain("Thanks for your order.");
    expect(text).toContain("https://example.com/invoices/42");
    expect(text).toContain("You get this as a customer.");
    expect(text).toMatch(/^48201739$/m);
    expect(text).not.toContain("Your invoice is ready");
    expect(text).not.toMatch(/<[a-z]/);
  });
});
