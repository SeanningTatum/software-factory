import { describe, expect, it } from "vitest";
import { makeNonce, securityHeaders } from "./security-headers.ts";

describe("securityHeaders", () => {
  it("sends a nonce CSP and HSTS in production", () => {
    const headers = securityHeaders("abc", true);
    expect(headers["content-security-policy"]).toContain(
      "script-src 'self' 'nonce-abc' 'strict-dynamic'",
    );
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(headers["strict-transport-security"]).toBeDefined();
  });

  it("lets the Turnstile frame in and nothing else", () => {
    const csp = securityHeaders("abc", true)["content-security-policy"] ?? "";
    expect(csp).toContain("frame-src https://challenges.cloudflare.com;");
    expect(csp).toContain("connect-src 'self';");
  });

  it("leaves the CSP out in development, where Vite injects inline scripts", () => {
    expect(securityHeaders("abc", false)["content-security-policy"]).toBeUndefined();
  });

  it("makes a different nonce each time", () => {
    expect(makeNonce()).not.toBe(makeNonce());
  });
});
