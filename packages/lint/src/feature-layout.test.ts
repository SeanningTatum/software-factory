import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { defaults } from "./config.ts";
import { lint } from "./lint.ts";

const project = (files: Record<string, string>) => {
  const root = mkdtempSync(join(tmpdir(), "cf-saas-layout-"));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
};

/** A feature that fits the layout, plus whatever a test adds. */
const kv = (extra: Record<string, string> = {}) =>
  project({
    "src/features/kv/feature.json": "{}",
    "src/features/kv/TIMELINE.md": "",
    "src/features/kv/layer.ts": "export const layer = 1;\n",
    "src/features/kv/layer.test.ts": "",
    "src/features/kv/api/key-value.ts": "export const kv = 1;\n",
    "src/features/kv/api/key-value.test.ts": "",
    "src/features/kv/api/adapters/memory.ts": "export const m = 1;\n",
    "src/features/kv/api/adapters/memory.test.ts": "",
    "src/features/kv/machines/sync.machine.ts": "export const m = 1;\n",
    "src/features/kv/machines/sync.machine.test.ts": "",
    "src/features/kv/e2e/kv.spec.ts": "",
    ...extra,
  });

const layout = (root: string, config = defaults) =>
  lint(root, config)
    .filter((f) => f.rule === "feature-layout")
    .map((f) => `${f.file}: ${f.message}`);

describe("feature-layout", () => {
  test("passes a feature that uses the vocabulary", () => {
    expect(layout(kv())).toEqual([]);
  });

  test("names a stray folder and lists what is allowed", () => {
    const [finding, ...rest] = layout(kv({ "src/features/kv/helpers/x.ts": "" }));
    expect(rest).toEqual([]);
    expect(finding).toStartWith(
      'src/features/kv/helpers/x.ts: "helpers/" is not a feature folder. A feature holds only the folders api/ (server functions and services), routes/',
    );
    expect(finding).toContain("lib/ (pure helpers)");
    expect(finding).toContain("feature.json, TIMELINE.md, constants.ts");
  });

  test("rejects unknown top-level files but allows sibling tests of known ones", () => {
    expect(
      layout(kv({ "src/features/kv/utils.ts": "", "src/features/kv/utils.test.ts": "" })),
    ).toEqual([
      expect.stringContaining('utils.test.ts: "utils.test.ts" may not sit at the top'),
      expect.stringContaining('utils.ts: "utils.ts" may not sit at the top'),
    ]);
  });

  test("keeps machines in components/ or machines/ and specs in e2e/", () => {
    expect(
      layout(
        kv({
          "src/features/kv/lib/cache.machine.ts": "",
          "src/features/kv/api/kv.spec.ts": "",
        }),
      ),
    ).toEqual([
      "src/features/kv/api/kv.spec.ts: *.spec.ts files go only in e2e/.",
      "src/features/kv/lib/cache.machine.ts: *.machine.ts files go only in components/ or machines/.",
    ]);
  });

  test("requires feature.json and TIMELINE.md in every feature", () => {
    const root = project({ "src/features/db/api/database.ts": "" });
    expect(layout(root)).toEqual([
      "src/features/db/feature.json: missing; every feature has feature.json and TIMELINE.md.",
      "src/features/db/TIMELINE.md: missing; every feature has feature.json and TIMELINE.md. `cf-saas-blocks sync` writes a fresh one.",
    ]);
  });

  test("reads the vocabulary from config", () => {
    const featureLayout = { ...defaults.featureLayout, folders: ["api", "helpers"] };
    const root = kv({ "src/features/kv/helpers/x.ts": "" });
    expect(layout(root, { ...defaults, featureLayout })).toEqual([
      expect.stringContaining('e2e/kv.spec.ts: "e2e/" is not a feature folder'),
      expect.stringContaining('machines/sync.machine.test.ts: "machines/" is not'),
      expect.stringContaining('machines/sync.machine.ts: "machines/" is not'),
    ]);
  });
});
