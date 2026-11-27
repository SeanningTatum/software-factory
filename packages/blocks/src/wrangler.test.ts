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

const limiter: BlockManifest = {
  name: "lim",
  title: "Lim",
  description: "lim",
  requires: [],
  bindings: [{ type: "ratelimit", binding: "L", namespace_id: "1001", limit: 10, period: 60 }],
};

describe("rate limits", () => {
  test("a namespace_id already in wrangler.jsonc is kept, and sync is then stable", () => {
    const manifests = new Map([["lim", limiter]]);
    const patch = { project: "acme", manifests, previouslyManaged: none };
    const first = patchWrangler("{}", patch).text;
    expect(parse(first).ratelimits[0].namespace_id).toBe("1001");
    expect(parse(first).env.staging.ratelimits[0].namespace_id).toBe("2001");
    const own = first.replace('"1001"', '"777"').replace('"2001"', '"778"');
    expect(patchWrangler(own, patch).text).toBe(own);
  });
});

describe("send_email", () => {
  test("is written by name in both environments, and sync is then stable", () => {
    const email: BlockManifest = {
      name: "email",
      title: "Email",
      description: "email",
      requires: [],
      bindings: [{ type: "send_email", binding: "EMAIL" }],
    };
    const patch = {
      project: "acme",
      manifests: new Map([["email", email]]),
      previouslyManaged: none,
    };
    const first = patchWrangler("{}", patch).text;
    expect(parse(first).send_email).toEqual([{ name: "EMAIL" }]);
    expect(parse(first).env.staging.send_email).toEqual([{ name: "EMAIL" }]);
    expect(patchWrangler(first, patch).text).toBe(first);
  });
});

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

  test("keeps fields and comments on managed entries, and the file's indent", () => {
    const text = `{
  "name": "app",
  "kv_namespaces": [
    {
      // prod KV, made by ops
      "binding": "KV",
      "id": "abc",
      "preview_id": "def"
    }
  ]
}`;
    const manifests = new Map([["kv", kv]]);
    const out = patchWrangler(text, { project: "acme", manifests, previouslyManaged: none }).text;
    expect(out).toContain("// prod KV, made by ops");
    expect(parse(out).kv_namespaces).toEqual([{ binding: "KV", id: "abc", preview_id: "def" }]);
    expect(out).not.toContain("\t");
  });

  test("refuses a file with a syntax error instead of editing it", () => {
    const broken = '{\n  "name": "app",\n  "kv_namespaces": [{ "binding": "KV" }\n}';
    expect(() =>
      patchWrangler(broken, {
        project: "acme",
        manifests: new Map([["kv", kv]]),
        previouslyManaged: none,
      }),
    ).toThrow(/wrangler.jsonc: .* on line 4/);
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
