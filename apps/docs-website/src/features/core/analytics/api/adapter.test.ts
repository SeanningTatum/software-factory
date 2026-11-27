import { describe, expect, it } from "vitest";
import { properties } from "./adapter.ts";

describe("properties", () => {
  it("drops the tag and keeps the rest", () => {
    expect(properties({ _tag: "page_viewed", path: "/a", referrer: "x" })).toEqual({
      path: "/a",
      referrer: "x",
    });
  });
});
