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
    if (exit._tag !== "Success") throw new Error("search failed");
    const hits = (await exit.value.json()) as { url: string }[];
    expect(hits.some((hit) => hit.url.startsWith("/docs/features"))).toBe(true);
  });

  it("refuses an address over the limit", async () =>
    expect(JSON.stringify(await run(false))).toContain("RateLimited"));
});
