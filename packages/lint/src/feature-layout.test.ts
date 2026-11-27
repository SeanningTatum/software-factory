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
      "src/features/db/TIMELINE.md: missing; every feature has feature.json and TIMELINE.md. `cf-saas-blocks sync` writes a fresh one.",
      "src/features/db/feature.json: missing; every feature has feature.json and TIMELINE.md.",
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

  test("passes core modules of each kind and the shared helpers", () => {
    const root = project({
      "src/features/core/ui/feature.json": "{}",
      "src/features/core/ui/TIMELINE.md": "",
      "src/features/core/ui/components/button.tsx": "",
      "src/features/core/ui/lib/cn.ts": "",
      "src/features/core/ui/lib/cn.test.ts": "",
      "src/features/core/kv/feature.json": "{}",
      "src/features/core/kv/TIMELINE.md": "",
      "src/features/core/kv/layer.ts": "",
      "src/features/core/kv/api/key-value.ts": "",
      "src/features/core/kv/machines/sync.machine.ts": "",
      "src/features/core/kv/routes/api/kv.ts": "",
      "src/features/core/lib/call.ts": "",
      "src/features/core/lib/call.test.ts": "",
    });
    expect(layout(root)).toEqual([]);
  });

  test("a services module with components/ mixes kinds and is told to leave core", () => {
    const [finding, ...rest] = layout(
      kv({
        "src/features/core/kv/feature.json": "{}",
        "src/features/core/kv/TIMELINE.md": "",
        "src/features/core/kv/api/key-value.ts": "",
        "src/features/core/kv/components/x.tsx": "",
      }),
    );
    expect(rest).toEqual([]);
    expect(finding).toBe(
      'src/features/core/kv/api/key-value.ts: "api/" next to components/ mixes kinds. Core holds shared modules of one kind: components only (components/, lib/), or services and helpers only (no components/, server routes only under routes/api/). A module with both, or with a page, is a feature; move it out of core to src/features/<name>.',
    );
  });

  test("a core module may not have pages, e2e specs, React outside components or UI machines", () => {
    const root = project({
      "src/features/core/kv/feature.json": "{}",
      "src/features/core/kv/TIMELINE.md": "",
      "src/features/core/kv/routes/settings.tsx": "",
      "src/features/core/kv/e2e/kv.spec.ts": "",
      "src/features/core/kv/api/widget.tsx": "",
      "src/features/core/ui/feature.json": "{}",
      "src/features/core/ui/TIMELINE.md": "",
      "src/features/core/ui/layer.ts": "",
      "src/features/core/ui/components/menu.machine.ts": "",
    });
    expect(layout(root).map((f) => f.slice(0, f.indexOf(" Core holds")))).toEqual([
      'src/features/core/kv/api/widget.tsx: "api/widget.tsx" is React in a services module.',
      'src/features/core/kv/e2e/kv.spec.ts: "e2e/" has no place in a core module.',
      'src/features/core/kv/routes/settings.tsx: "routes/settings.tsx" is a page; a core module serves only server routes under routes/api/.',
      "src/features/core/ui/components/menu.machine.ts: a machine beside shared components gives them logic of their own.",
      'src/features/core/ui/layer.ts: "layer.ts" next to components/ mixes kinds; a components module has only feature.json, TIMELINE.md, constants.ts at its top.',
    ]);
  });

  test("core/lib holds flat .ts files and needs no feature.json; loose files in core are named", () => {
    const root = project({
      "src/features/core/lib/call.ts": "",
      "src/features/core/lib/nested/x.ts": "",
      "src/features/core/lib/view.tsx": "",
      "src/features/core/stray.ts": "",
    });
    expect(layout(root)).toEqual([
      "src/features/core/lib/nested/x.ts: src/features/core/lib/ holds flat .ts helpers, each with a sibling test: no folders, no React, no feature.json.",
      "src/features/core/lib/view.tsx: src/features/core/lib/ holds flat .ts helpers, each with a sibling test: no folders, no React, no feature.json.",
      "src/features/core/stray.ts: core modules are folders; move this into one.",
    ]);
  });
});
