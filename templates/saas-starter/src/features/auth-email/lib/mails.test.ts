import { describe, expect, it } from "vitest";
import { codeMail } from "./mails.ts";

describe("codeMail", () => {
  it("carries the code in both the text and the HTML part", () => {
    const mail = codeMail("forget-password", "123456");
    expect(mail.subject).toBe("Reset your password");
    expect(mail.text).toContain("123456");
    expect(mail.html).toContain("<strong>123456</strong>");
  });

  it("keeps the code out of the subject, which lock screens show", () => {
    expect(codeMail("sign-in", "123456").subject).not.toContain("123456");
  });
});
