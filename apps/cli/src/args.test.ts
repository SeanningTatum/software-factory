import { describe, expect, test } from "bun:test";
import { legacyArgs } from "./args.ts";

describe("legacyArgs", () => {
  test("turns --blocks into --features and leaves the rest", () => {
    expect(legacyArgs(["my-app", "--blocks", "d1,auth", "--yes"])).toEqual([
      "my-app",
      "--features",
      "d1,auth",
      "--yes",
    ]);
    expect(legacyArgs(["my-app", "--blocks=kv"])).toEqual(["my-app", "--features=kv"]);
    expect(legacyArgs(["add", "kv"])).toEqual(["add", "kv"]);
  });
});
