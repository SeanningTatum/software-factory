import { describe, expect, it } from "vitest";
import { parentSpanFor, parseTraceparent, requestIdFrom, requestInfoFrom } from "./request.ts";

const TRACE = "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01";

describe("parseTraceparent", () => {
  it("reads a valid header", () => {
    expect(parseTraceparent(TRACE)).toEqual({
      traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
      spanId: "00f067aa0ba902b7",
      sampled: true,
    });
  });

  it.each([
    ["missing", null],
    ["garbage", "hello"],
    ["version ff", TRACE.replace(/^00/, "ff")],
    ["zero trace id", `00-${"0".repeat(32)}-00f067aa0ba902b7-01`],
    ["zero span id", `00-4bf92f3577b34da6a3ce929d0e0e4736-${"0".repeat(16)}-01`],
  ])("rejects %s", (_, header) => {
    expect(parseTraceparent(header)).toBeUndefined();
  });
});

describe("requestIdFrom", () => {
  it("prefers the trace id", () => {
    expect(
      requestIdFrom(new Headers({ traceparent: TRACE, "cf-ray": "8f1e2d3c4b5a6978-SJC" })),
    ).toBe("4bf92f3577b34da6a3ce929d0e0e4736");
  });

  it("falls back to a well-formed cf-ray", () => {
    expect(requestIdFrom(new Headers({ "cf-ray": "8f1e2d3c4b5a6978-SJC" }))).toBe(
      "8f1e2d3c4b5a6978-SJC",
    );
  });

  it("ignores a malformed cf-ray and makes a random id", () => {
    const id = requestIdFrom(new Headers({ "cf-ray": "<script>" }));
    expect(id).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe("requestInfoFrom", () => {
  it("records method and path, with no user yet", () => {
    const info = requestInfoFrom(
      new Request("https://example.com/dashboard?x=1", { method: "POST" }),
    );
    expect(info).toMatchObject({ method: "POST", path: "/dashboard", userId: undefined });
  });
});

describe("parentSpanFor", () => {
  it("continues the caller's trace", () => {
    const info = requestInfoFrom(
      new Request("https://x.dev/", { headers: { traceparent: TRACE } }),
    );
    expect(parentSpanFor(info)).toMatchObject({
      traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
      spanId: "00f067aa0ba902b7",
    });
  });

  it("uses a random request id as the trace id", () => {
    const info = requestInfoFrom(new Request("https://x.dev/"));
    expect(parentSpanFor(info).traceId).toBe(info.id);
  });
});
