import { describe, expect, it } from "vitest";
import { authEvents } from "./auth-events.ts";

describe("authEvents", () => {
  it("records a completed sign-up against the new user", () => {
    expect(authEvents("POST", "/api/auth/sign-up/email", 200, { user: { id: "u1" } })).toEqual([
      { event: { _tag: "sign_up_completed", method: "email" }, distinctId: "u1" },
    ]);
  });

  it.each([
    [401, "invalid_credentials"],
    [429, "rate_limited"],
    [500, "other"],
  ])("records a failed sign-in (%i) with a reason code and no user", (status, reason) => {
    expect(authEvents("POST", "/api/auth/sign-in/email", status, null)).toEqual([
      { event: { _tag: "sign_in_failed", reason } },
    ]);
  });

  it("records a sign-in asked for a Turnstile token as challenged", () => {
    const body = { code: "MISSING_RESPONSE", message: "Missing CAPTCHA response" };
    expect(authEvents("POST", "/api/auth/sign-in/email", 400, body)).toEqual([
      { event: { _tag: "sign_in_failed", reason: "challenged" } },
    ]);
  });

  it("records sign-out", () => {
    expect(authEvents("POST", "/api/auth/sign-out", 200, null)[0]?.event._tag).toBe("signed_out");
  });

  it("records the code paths auth-email serves: sign-in by code, verification and reset", () => {
    const user = { user: { id: "u1" } };
    expect(authEvents("POST", "/api/auth/sign-in/email-otp", 200, user)).toEqual([
      { event: { _tag: "sign_in_succeeded", method: "code" }, distinctId: "u1" },
    ]);
    expect(authEvents("POST", "/api/auth/sign-in/email-otp", 400, null)[0]?.event._tag).toBe(
      "sign_in_failed",
    );
    expect(authEvents("POST", "/api/auth/email-otp/verify-email", 200, user)).toEqual([
      { event: { _tag: "email_verified" }, distinctId: "u1" },
    ]);
    expect(authEvents("POST", "/api/auth/email-otp/reset-password", 200, {})).toEqual([
      { event: { _tag: "password_reset" } },
    ]);
  });

  it("ignores everything else", () => {
    expect(authEvents("GET", "/api/auth/get-session", 200, {})).toEqual([]);
  });
});
