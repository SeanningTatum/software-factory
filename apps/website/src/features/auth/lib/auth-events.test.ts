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

  it("records sign-out", () => {
    expect(authEvents("POST", "/api/auth/sign-out", 200, null)[0]?.event._tag).toBe("signed_out");
  });

  it("ignores everything else", () => {
    expect(authEvents("GET", "/api/auth/get-session", 200, {})).toEqual([]);
  });
});
