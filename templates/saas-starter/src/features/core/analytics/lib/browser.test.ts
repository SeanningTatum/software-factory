import { describe, expect, it } from "vitest";
import type { Metric } from "web-vitals";
import {
  anonIdCookie,
  browserDistinctId,
  clearAnonIdCookie,
  readAnonId,
  vitalEvent,
} from "./browser.ts";

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

describe("browserDistinctId", () => {
  const aid = "0b9c6a4e-6d0e-4c3f-9a51-1f0e2b3c4d5e";
  it("uses the signed-in user's id", () =>
    expect(browserDistinctId("user-1", `aid=${aid}`, "req")).toBe("user-1"));
  it("keeps one id across a signed-out visitor's requests", () => {
    expect(browserDistinctId(undefined, `consent=granted; aid=${aid}`, "req-1")).toBe(
      `anon:${aid}`,
    );
    expect(browserDistinctId(undefined, `aid=${aid}`, "req-2")).toBe(`anon:${aid}`);
  });
  it("ignores a malformed cookie", () =>
    expect(browserDistinctId(undefined, "aid=<script>", "req")).toBe("anon:req"));
});

describe("anon id cookie", () => {
  it("round-trips", () => {
    const id = crypto.randomUUID();
    expect(readAnonId(anonIdCookie(id).split(";")[0])).toBe(id);
  });
  it("clears the cookie it set: same name and Path, Max-Age=0", () => {
    const parts = (cookie: string) => cookie.split("; ").map((part) => part.split("=")[0]);
    const path = (cookie: string) => cookie.split("; ").find((part) => part.startsWith("Path="));
    const set = anonIdCookie(crypto.randomUUID());
    expect(parts(clearAnonIdCookie)[0]).toBe(parts(set)[0]);
    expect(path(clearAnonIdCookie)).toBe(path(set));
    expect(clearAnonIdCookie.split("; ")).toContain("Max-Age=0");
  });
});
