import { describe, expect, it } from "vitest";
import { binding } from "./binding.ts";

interface Kv {
  get(key: string): Promise<string | null>;
}

describe("binding", () => {
  it("returns the binding under that name", () => {
    const kv: Kv = { get: () => Promise.resolve(null) };
    expect(binding<Kv>({ KV: kv, APP_URL: "x" }, "KV")).toBe(kv);
  });

  it("is undefined when the env has no such binding", () => {
    expect(binding<Kv>({ APP_URL: "x" }, "KV")).toBeUndefined();
    expect(binding<Kv>({ KV: null }, "KV")).toBeUndefined();
  });
});
