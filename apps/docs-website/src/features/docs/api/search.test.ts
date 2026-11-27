import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { type AppEnv, CloudflareEnv } from "#/app/env.ts";
import { searchDocs } from "./search.ts";

const run = (allow: boolean) =>
  searchDocs(new Request("https://x.dev/api/search?query=billing")).pipe(
    Effect.provide(
      CloudflareEnv.layer({
        SEARCH_LIMITER: { limit: async () => ({ success: allow }) },
      } as unknown as AppEnv),
    ),
    Effect.runPromiseExit,
  );

describe("searchDocs", () => {
  it("answers with hits under the limit", async () => {
    const exit = await run(true);
    expect(exit._tag).toBe("Success");
  });

  it("refuses an address over the limit", async () =>
    expect(JSON.stringify(await run(false))).toContain("RateLimited"));
});
