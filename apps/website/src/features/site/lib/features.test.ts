import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { coreFeatures, features } from "./features.ts";

const FEATURES = "src/features";

const manifests = readdirSync(FEATURES).map(
  (name) =>
    JSON.parse(readFileSync(join(FEATURES, name, "feature.json"), "utf8")) as {
      name: string;
      core?: boolean;
      requires: ReadonlyArray<string>;
    },
);

describe("site features", () => {
  it("lists every optional feature, with what each requires", () => {
    const optional = manifests.filter((m) => !m.core);
    expect(features.map((f) => f.name).sort()).toEqual(optional.map((m) => m.name).sort());
    for (const f of features) {
      expect(f.requires, f.name).toEqual(optional.find((m) => m.name === f.name)?.requires);
    }
  });

  it("lists the template's core features, not the site's own", () => {
    const core = manifests.filter((m) => m.core && m.name !== "site").map((m) => m.name);
    expect([...coreFeatures].sort()).toEqual(core.sort());
  });
});
