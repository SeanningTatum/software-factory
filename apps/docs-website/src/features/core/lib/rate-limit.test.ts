import { Effect, Exit } from "effect";
import { describe, expect, it } from "vitest";
import { checkLimit, clientAddress } from "./rate-limit.ts";

const run = (success: boolean | "throws") =>
  Effect.runPromiseExit(
    checkLimit(
      {
        limit: async () => (success === "throws" ? Promise.reject(new Error("down")) : { success }),
      },
      "k",
    ),
  );

describe("checkLimit", () => {
  it("lets a request under the limit through", async () =>
    expect(Exit.isSuccess(await run(true))).toBe(true));
  it("fails with RateLimited over the limit", async () =>
    expect(JSON.stringify(await run(false))).toContain("RateLimited"));
  it("fails open when the limiter itself is down", async () =>
    expect(Exit.isSuccess(await run("throws"))).toBe(true));
  it("lets everything through without a binding", async () =>
    expect(Exit.isSuccess(await Effect.runPromiseExit(checkLimit(undefined, "k")))).toBe(true));
});

describe("clientAddress", () => {
  it("reads Cloudflare's client address", () =>
    expect(clientAddress(new Headers({ "cf-connecting-ip": "1.2.3.4" }))).toBe("1.2.3.4"));
  it.each([
    ["2001:db8:1:2:aaaa:bbbb:cccc:dddd", "2001:db8:1:2::/64"],
    ["2001:DB8:1:2:ffff::1", "2001:db8:1:2::/64"],
    ["2001:db8::1", "2001:db8:0:0::/64"],
    ["::1", "0:0:0:0::/64"],
    ["::ffff:1.2.3.4", "::ffff:1.2.3.4"],
  ])("keys IPv6 %s by its first 64 bits", (ip, key) =>
    expect(clientAddress(new Headers({ "cf-connecting-ip": ip }))).toBe(key),
  );
  it("falls back outside Cloudflare", () => expect(clientAddress(new Headers())).toBe("unknown"));
});
