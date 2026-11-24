import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { consoleAdapter, noopAdapter } from "./basic.ts";

const batch = [
  { event: { _tag: "page_viewed" as const, path: "/" }, distinctId: "a", timestamp: "t" },
];

describe("basic adapters", () => {
  it("noop accepts anything", async () => {
    await expect(Effect.runPromise(noopAdapter.send(batch))).resolves.toBeUndefined();
  });
  it("console logs one line per event", async () => {
    await expect(Effect.runPromise(consoleAdapter.send(batch))).resolves.toBeUndefined();
  });
});
