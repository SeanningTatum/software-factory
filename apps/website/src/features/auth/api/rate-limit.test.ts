import { Effect, Exit } from "effect";
import { describe, expect, it } from "vitest";
import { AuthRateLimiter, accountKey, LIMITED_PATHS, limitKey } from "./rate-limit.ts";

const run = (success: boolean | "throws") =>
  Effect.runPromiseExit(
    AuthRateLimiter.fromLimiter({
      limit: async () => {
        if (success === "throws") throw new Error("limiter down");
        return { success };
      },
    }).check("k"),
  );

describe("AuthRateLimiter", () => {
  it("lets a request under the limit through", async () =>
    expect(Exit.isSuccess(await run(true))).toBe(true));
  it("fails with RateLimited over the limit", async () => {
    expect(JSON.stringify(await run(false))).toContain("RateLimited");
  });
  it("fails open when the limiter itself is down", async () =>
    expect(Exit.isSuccess(await run("throws"))).toBe(true));
  it("lets everything through without a binding", async () => {
    expect(
      Exit.isSuccess(
        await Effect.runPromiseExit(AuthRateLimiter.fromLimiter(undefined).check("k")),
      ),
    ).toBe(true);
  });
  it("keys by client address and path", () => {
    expect(limitKey(new Headers({ "cf-connecting-ip": "1.2.3.4" }), "/x")).toBe("1.2.3.4:/x");
  });
  it("keys an account by its lower-cased email", () =>
    expect(accountKey("Ada@Example.com")).toBe("acct:ada@example.com"));
  it("limits the Stripe endpoints that call Stripe several times", () =>
    expect(LIMITED_PATHS).toEqual(
      expect.arrayContaining([
        "/api/auth/subscription/upgrade",
        "/api/auth/subscription/billing-portal",
        "/api/auth/subscription/cancel",
        "/api/auth/subscription/restore",
      ]),
    ));
});
