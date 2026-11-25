import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadManifests } from "./manifest.ts";

const project = (features: Record<string, Record<string, unknown>>) => {
  const root = mkdtempSync(join(tmpdir(), "cf-saas-manifest-"));
  for (const [name, extra] of Object.entries(features)) {
    mkdirSync(join(root, "src/features", name), { recursive: true });
    const manifest = { name, title: name, description: name, requires: [], ...extra };
    writeFileSync(join(root, "src/features", name, "feature.json"), JSON.stringify(manifest));
  }
  return root;
};

const spec = { description: "x", required: false };
const workflow = (binding: string, class_name: string) => ({
  type: "workflow",
  binding,
  name: binding,
  class_name,
});

describe("loadManifests", () => {
  test("rejects two features that declare the same var, secret, binding or workflow class", () => {
    const clashes: ReadonlyArray<[Record<string, unknown>, Record<string, unknown>, string]> = [
      [{ vars: { KEY: spec } }, { vars: { KEY: spec } }, "KEY"],
      [{ secrets: { KEY: spec } }, { vars: { KEY: spec } }, "KEY"],
      [{ bindings: [workflow("A", "Flow")] }, { bindings: [workflow("A", "Other")] }, "A"],
      [{ bindings: [workflow("A", "Flow")] }, { bindings: [workflow("B", "Flow")] }, "Flow"],
    ];
    for (const [a, b, key] of clashes) {
      expect(() => loadManifests(project({ a, b }))).toThrow(
        `"${key}" is declared by both a and b`,
      );
    }
  });

  test("accepts distinct declarations", () => {
    const root = project({
      a: { vars: { A: spec }, bindings: [workflow("WA", "FlowA")] },
      b: { secrets: { B: spec }, bindings: [workflow("WB", "FlowB")] },
    });
    expect([...loadManifests(root).keys()]).toEqual(["a", "b"]);
  });

  test("rejects a rate-limit namespace_id that is not digits", () => {
    const limiter = (namespace_id: string) => ({
      bindings: [{ type: "ratelimit", binding: "L", namespace_id, limit: 10, period: 60 }],
    });
    expect(() => loadManifests(project({ a: limiter("abc") }))).toThrow(/namespace_id/);
    expect(() => loadManifests(project({ a: limiter("") }))).toThrow(/namespace_id/);
    expect(loadManifests(project({ a: limiter("1001") })).size).toBe(1);
  });
});
