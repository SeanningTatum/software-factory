import { Effect, Exit } from "effect";
import { describe, expect, it } from "vitest";
import { type AppEnv, CloudflareEnv } from "#/core/env.ts";
import { requireTriggerToken, safeEqual } from "./trigger-auth.ts";

const run = (env: Record<string, string>, auth?: string) =>
  Effect.runPromiseExit(
    requireTriggerToken(new Headers(auth ? { authorization: auth } : {})).pipe(
      Effect.provide(CloudflareEnv.layer(env as unknown as AppEnv)),
    ),
  );

describe("requireTriggerToken", () => {
  it("accepts the right bearer token", async () => {
    expect(Exit.isSuccess(await run({ WORKFLOWS_TRIGGER_TOKEN: "t0ken" }, "Bearer t0ken"))).toBe(
      true,
    );
  });
  it("refuses a wrong or missing token", async () => {
    expect(
      JSON.stringify(await run({ WORKFLOWS_TRIGGER_TOKEN: "t0ken" }, "Bearer nope")),
    ).toContain("Unauthorized");
    expect(JSON.stringify(await run({ WORKFLOWS_TRIGGER_TOKEN: "t0ken" }))).toContain(
      "Unauthorized",
    );
  });
  it("is closed until a token is set", async () => {
    expect(JSON.stringify(await run({}, "Bearer anything"))).toContain("NotConfigured");
  });
  it("compares strings exactly", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
});
