import { Effect, ErrorReporter, Layer } from "effect";
import { describe, expect, it } from "vitest";
import { type AppEnv, CloudflareEnv } from "#/app/env.ts";
import { reportBrowserError } from "./browser-report.ts";

const run = async (allow: boolean) => {
  const reported: Array<string> = [];
  const env = { REPORT_LIMITER: { limit: async () => ({ success: allow }) } } as unknown as AppEnv;
  const request = new Request("https://x.dev/api/browser-report", {
    method: "POST",
    body: JSON.stringify({ message: "boom", path: "/" }),
  });
  const exit = await reportBrowserError(request).pipe(
    Effect.provide(
      Layer.mergeAll(
        CloudflareEnv.layer(env),
        ErrorReporter.layer([ErrorReporter.make(({ error }) => void reported.push(error.message))]),
      ),
    ),
    Effect.runPromiseExit,
  );
  return { exit, reported };
};

describe("reportBrowserError", () => {
  it("reports a browser error", async () => expect((await run(true)).reported).toEqual(["boom"]));

  it("refuses an address over the limit without reporting", async () => {
    const { exit, reported } = await run(false);
    expect(JSON.stringify(exit)).toContain("RateLimited");
    expect(reported).toEqual([]);
  });
});
