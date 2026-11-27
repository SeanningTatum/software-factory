import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { analyticsEngineAdapter } from "./analytics-engine.ts";

describe("analyticsEngineAdapter", () => {
  it("writes one indexed data point per event", async () => {
    const points: Array<unknown> = [];
    await Effect.runPromise(
      analyticsEngineAdapter({ writeDataPoint: (p) => void points.push(p) }).send([
        { event: { _tag: "page_viewed", path: "/a" }, distinctId: "u1", timestamp: "t" },
      ]),
    );
    expect(points).toEqual([{ indexes: ["page_viewed"], blobs: ["u1", '{"path":"/a"}'] }]);
  });
});
