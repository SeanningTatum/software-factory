import { describe, expect, it } from "vitest";
import { codeMail } from "./mails.ts";

describe("codeMail", () => {
  it("carries the code in both the text and the HTML part, in the shared layout", () => {
    const mail = codeMail("forget-password", "12345678");
    expect(mail.subject).toBe("Reset your password");
    expect(mail.text).toMatch(/\b12345678\b/);
    expect(mail.html).toContain("12345678");
    expect(mail.html).toMatch(/^<!DOCTYPE html/);
  });

  it("keeps the code out of the subject and the preview, which lock screens show", () => {
    const mail = codeMail("sign-in", "12345678");
    expect(mail.subject).not.toContain("12345678");
    expect(mail.html.split("12345678")).toHaveLength(2);
  });
});
