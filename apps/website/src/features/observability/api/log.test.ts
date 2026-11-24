import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { requestInfoFrom } from "#/app/request.ts";
import { LoggerLayer, parseLevel } from "./log.ts";

const capture = () => {
  const lines: Array<Record<string, unknown>> = [];
  return { lines, sink: (_: string, line: Record<string, unknown>) => void lines.push(line) };
};

describe("logger", () => {
  it("stamps every line with the request id, the user and the span, and redacts it", async () => {
    const info = requestInfoFrom(
      new Request("https://x.dev/a", { headers: { "cf-ray": "8f1e2d3c4b5a6978-SJC" } }),
    );
    info.userId = "user_1";
    const { lines, sink } = capture();
    await Effect.runPromise(
      Effect.logInfo("signed in ada@example.com").pipe(
        Effect.annotateLogs({ route: "/a" }),
        Effect.withSpan("handler"),
        Effect.provide(LoggerLayer(info, "Info", sink)),
      ),
    );
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      level: "Info",
      requestId: "8f1e2d3c4b5a6978-SJC",
      userId: "user_1",
      route: "/a",
    });
    expect(lines[0]?.spanId).toEqual(expect.any(String));
    expect(String(lines[0]?.message)).not.toContain("example.com");
  });

  it("drops lines below the minimum level", async () => {
    const { lines, sink } = capture();
    const info = requestInfoFrom(new Request("https://x.dev/"));
    await Effect.runPromise(
      Effect.logDebug("noise").pipe(
        Effect.andThen(Effect.logWarning("kept")),
        Effect.provide(LoggerLayer(info, "Warn", sink)),
      ),
    );
    expect(lines.map((l) => l.message)).toEqual(["kept"]);
  });

  it("parses a level case-insensitively and defaults to Info", () => {
    expect(parseLevel("debug")).toBe("Debug");
    expect(parseLevel(undefined)).toBe("Info");
    expect(parseLevel("loud")).toBe("Info");
  });
});
