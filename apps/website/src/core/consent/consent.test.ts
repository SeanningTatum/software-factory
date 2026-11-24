import { describe, expect, it } from "vitest";
import { consentCookie, optedOutFrom, readConsent } from "./consent.ts";

describe("consent cookie", () => {
  it("reads a saved choice among other cookies", () => {
    expect(readConsent("a=1; consent=granted; b=2")).toBe("granted");
    expect(readConsent("consent=denied")).toBe("denied");
  });
  it("ignores anything else", () => {
    expect(readConsent("consent=maybe")).toBeUndefined();
    expect(readConsent(undefined)).toBeUndefined();
  });
  it("writes a year-long first-party cookie", () => {
    expect(consentCookie("granted")).toContain("Max-Age=31536000");
  });
  it("honours GPC and DNT", () => {
    expect(optedOutFrom(new Headers({ "sec-gpc": "1" }))).toBe(true);
    expect(optedOutFrom(new Headers({ dnt: "1" }))).toBe(true);
    expect(optedOutFrom(new Headers())).toBe(false);
  });
});
