import { describe, expect, test } from "bun:test";
import { dependentsOf, topoSort, withRequirements } from "./graph.ts";
import type { BlockManifest } from "./manifest.ts";

const block = (name: string, requires: Array<string> = []): BlockManifest => ({
  name,
  title: name,
  description: name,
  requires,
});
const manifests = new Map(
  [block("d1"), block("auth", ["d1"]), block("billing", ["auth"]), block("kv")].map((m) => [m.name, m]),
);

describe("graph", () => {
  test("adds what a block requires, in order", () => {
    expect(withRequirements(manifests, ["billing"])).toEqual(["d1", "auth", "billing"]);
  });
  test("sorts independent blocks by name", () => {
    expect(topoSort(manifests, ["kv", "d1"])).toEqual(["d1", "kv"]);
  });
  test("finds every block that depends on another", () => {
    expect(dependentsOf(manifests, ["d1", "auth", "billing", "kv"], "d1")).toEqual(["auth", "billing"]);
  });
  test("refuses a block whose requirement is missing", () => {
    expect(() => topoSort(manifests, ["auth"])).toThrow(/requires "d1"/);
  });
});
