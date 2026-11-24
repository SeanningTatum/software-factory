import { Effect, Layer, ManagedRuntime } from "effect";
import { describe, expect, it, vi } from "vitest";
import { NotFound } from "./errors.ts";
import { requestInfoFrom } from "./request.ts";
import {
  describeFailure,
  type EdgeContext,
  PublicError,
  runEffect,
  runResponse,
} from "./run-effect.ts";
import type { AppRuntime } from "./runtime.ts";

vi.mock("@tanstack/react-start/server", () => ({ setResponseStatus: vi.fn() }));

const context = (): EdgeContext => ({
  runtime: ManagedRuntime.make(Layer.empty) as unknown as AppRuntime,
  request: requestInfoFrom(
    new Request("https://x.dev/", { headers: { "cf-ray": "8f1e2d3c4b5a6978-SJC" } }),
  ),
});

describe("runEffect", () => {
  it("returns the value of a successful effect", async () => {
    await expect(runEffect(context(), Effect.succeed(42))).resolves.toBe(42);
  });

  it("throws a PublicError with the mapped status and the request id", async () => {
    const error = await runEffect(context(), Effect.fail(new NotFound({ what: "user" }))).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(PublicError);
    expect(error).toMatchObject({
      status: 404,
      body: { error: "NotFound", requestId: "8f1e2d3c4b5a6978-SJC" },
    });
  });
});

describe("runResponse", () => {
  it("hides a defect behind a plain 500", async () => {
    const response = await runResponse(context(), Effect.die(new Error("db password is hunter2")));
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("hunter2");
  });
});

describe("describeFailure", () => {
  it("treats an untagged failure as internal", () => {
    const { info } = describeFailure(
      Effect.runSyncExit(Effect.fail("oops")).pipe((e) =>
        e._tag === "Failure" ? e.cause : (undefined as never),
      ),
      "id",
    );
    expect(info.status).toBe(500);
  });
});
