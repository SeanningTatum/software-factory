import { describe, expect, it } from "vitest";
import { authEvents, setsSession } from "./auth-events.ts";

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

  it("records sign-out and GitHub sign-in", () => {
    expect(authEvents("POST", "/api/auth/sign-out", 200, null)[0]?.event._tag).toBe("signed_out");
    expect(authEvents("GET", "/api/auth/callback/github", 302, null, true)[0]?.event._tag).toBe(
      "sign_in_succeeded",
    );
  });

  it("does not count a GitHub callback that redirects to an error as a sign-in", () => {
    expect(authEvents("GET", "/api/auth/callback/github", 302, null, false)).toEqual([]);
  });
});

describe("setsSession", () => {
  const headers = (...cookies: Array<string>) => {
    const h = new Headers();
    for (const cookie of cookies) h.append("set-cookie", cookie);
    return h;
  };
  it("sees a new session cookie", () => {
    expect(setsSession(headers("better-auth.session_token=abc.def; Path=/; HttpOnly"))).toBe(true);
    expect(setsSession(headers("__Secure-better-auth.session_token=abc; Secure"))).toBe(true);
  });
  it("ignores state cookies and a cleared session", () => {
    expect(setsSession(headers("better-auth.state=x; Path=/"))).toBe(false);
    expect(setsSession(headers("better-auth.session_token=; Max-Age=0"))).toBe(false);
    expect(setsSession(headers())).toBe(false);
  });

  it("ignores everything else", () => {
    expect(authEvents("GET", "/api/auth/get-session", 200, {})).toEqual([]);
  });
});
