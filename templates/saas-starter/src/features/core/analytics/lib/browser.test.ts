import { describe, expect, it } from "vitest";
import type { Metric } from "web-vitals";
import { vitalEvent } from "./browser.ts";

describe("vitalEvent", () => {
  it("turns a web-vitals metric into a catalog event", () => {
    const metric = { name: "LCP", value: 1200, rating: "good" } as Metric;
    expect(vitalEvent(metric, "/pricing")).toEqual({
      _tag: "web_vital",
      metric: "LCP",
      value: 1200,
      rating: "good",
      path: "/pricing",
    });
  });
});
