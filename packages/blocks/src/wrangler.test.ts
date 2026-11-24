import { describe, expect, test } from "bun:test";
import { parse } from "jsonc-parser";
import type { BlockManifest } from "./manifest.ts";
import { PLACEHOLDER_D1_ID, patchWrangler, setBindingField } from "./wrangler.ts";

const d1: BlockManifest = {
  name: "d1",
  title: "D1",
  description: "db",
  requires: [],
  bindings: [{ type: "d1", binding: "DB", database: "{project}-db{suffix}" }],
  vars: { DB_LOG: { description: "log", required: false, default: "off" } },
};
const kv: BlockManifest = {
  name: "kv",
  title: "KV",
  description: "kv",
  requires: [],
  bindings: [{ type: "kv", binding: "KV", namespace: "{project}-kv{suffix}" }],
};
const base = `{
  // keep me
  "name": "app",
  "vars": { "MINE": "1" },
  "kv_namespaces": [{ "binding": "HAND_MADE", "id": "abc" }]
}`;
const none = { bindings: [], vars: [] };

describe("patchWrangler", () => {
  test("adds bindings for production and staging and keeps hand-made ones", () => {
    const { text, managed } = patchWrangler(base, {
      project: "acme",
      manifests: new Map([
        ["d1", d1],
        ["kv", kv],
      ]),
      previouslyManaged: none,
    });
    const json = parse(text);
    expect(text).toContain("// keep me");
    expect(json.d1_databases[0]).toMatchObject({
      binding: "DB",
      database_name: "acme-db",
      database_id: PLACEHOLDER_D1_ID,
    });
    expect(json.env.staging.d1_databases[0].database_name).toBe("acme-db-staging");
    expect(json.kv_namespaces.map((k: { binding: string }) => k.binding)).toEqual([
      "HAND_MADE",
      "KV",
    ]);
    expect(json.vars).toEqual({ MINE: "1", DB_LOG: "off" });
    expect(managed).toEqual({ bindings: ["DB", "KV"], vars: ["DB_LOG"] });
  });

  test("keeps ids setup filled in, and running twice changes nothing", () => {
    const manifests = new Map([["d1", d1]]);
    const first = patchWrangler(base, { project: "acme", manifests, previouslyManaged: none });
    const withId = setBindingField(
      first.text,
      "production",
      "d1_databases",
      "DB",
      "database_id",
      "real-id",
    );
    const second = patchWrangler(withId, {
      project: "acme",
      manifests,
      previouslyManaged: first.managed,
    });
    expect(parse(second.text).d1_databases[0].database_id).toBe("real-id");
    expect(
      patchWrangler(second.text, { project: "acme", manifests, previouslyManaged: second.managed })
        .text,
    ).toBe(second.text);
  });

  test("removes only what it added once a block is gone", () => {
    const added = patchWrangler(base, {
      project: "acme",
      manifests: new Map([["kv", kv]]),
      previouslyManaged: none,
    });
    const removed = patchWrangler(added.text, {
      project: "acme",
      manifests: new Map(),
      previouslyManaged: added.managed,
    });
    const json = parse(removed.text);
    expect(json.kv_namespaces).toEqual([{ binding: "HAND_MADE", id: "abc" }]);
    expect(json.env.staging).toEqual({});
  });
});
