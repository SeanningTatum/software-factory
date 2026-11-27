// cf-saas-lint allow comments
import { convert } from "html-to-text";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const DOCTYPE =
  '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">';

/**
 * A mail as the two parts `Email.send` takes; the text is made from the HTML, so they agree.
 * Not `@react-email/render`: it brings prettier into the Worker, about 90 kB gzipped, to do this.
 */
export const renderMail = (mail: ReactElement) => {
  const html = `${DOCTYPE}${renderToStaticMarkup(mail)}`;
  const text = convert(html, {
    wordwrap: false,
    selectors: [
      { selector: "img", format: "skip" },
      // React Email marks the inbox preview line this way; the text part starts at the heading.
      { selector: "[data-skip-in-text=true]", format: "skip" },
      { selector: "a", options: { linkBrackets: false } },
    ],
  });
  return { html, text };
};
