import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { anonymous, pickViewer } from "./viewer.ts";

describe("pickViewer", () => {
  it("is anonymous when no block provides a viewer", async () => {
    await expect(Effect.runPromise(pickViewer([]))).resolves.toEqual(anonymous);
  });

  it("uses the first block's viewer", async () => {
    const viewer = { signedIn: true, userId: "u1" };
    await expect(Effect.runPromise(pickViewer([Effect.succeed(viewer)]))).resolves.toBe(viewer);
  });
});
