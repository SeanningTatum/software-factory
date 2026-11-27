import { describe, expect, it } from "vitest";
import type { AppEnv } from "./env.ts";
import { requestInfoFrom } from "./request.ts";
import { makeRuntime } from "./runtime.ts";
import { currentViewer } from "./viewer.ts";

describe("makeRuntime", () => {
  it("builds with no bindings, vars or secrets, so a fresh fork still serves pages", async () => {
    const runtime = makeRuntime({
      env: {} as AppEnv,
      request: requestInfoFrom(new Request("https://x.dev/")),
      waitUntil: () => undefined,
    });
    await expect(runtime.runPromise(currentViewer)).resolves.toMatchObject({ signedIn: false });
    await runtime.dispose();
  });
});
