import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { features, requiredFeatures, requiredModules } from "./features.ts";

const FEATURES = "src/features";
const CORE = "src/features/core";

const read = (dir: string, core: boolean) =>
  readdirSync(dir)
    .filter((name) => existsSync(join(dir, name, "feature.json")))
    .map((name) => ({
      ...(JSON.parse(readFileSync(join(dir, name, "feature.json"), "utf8")) as {
        name: string;
        required?: boolean;
        requires: ReadonlyArray<string>;
      }),
      core,
    }));

const manifests = [...read(CORE, true), ...read(FEATURES, false)];

describe("site features", () => {
  it("lists every optional feature and core module, with what each requires and where it lives", () => {
    const optional = manifests.filter((m) => !m.required);
    expect(features.map((f) => f.name).sort()).toEqual(optional.map((m) => m.name).sort());
    for (const f of features) {
      const m = optional.find((o) => o.name === f.name);
      expect(f.requires, f.name).toEqual(m?.requires);
      expect(f.core, f.name).toBe(m?.core);
    }
  });

  it("lists the template's required modules and features, not the site's own", () => {
    const required = manifests.filter((m) => m.required && m.name !== "site");
    expect([...requiredModules].sort()).toEqual(
      required
        .filter((m) => m.core)
        .map((m) => m.name)
        .sort(),
    );
    expect([...requiredFeatures].sort()).toEqual(
      required
        .filter((m) => !m.core)
        .map((m) => m.name)
        .sort(),
    );
  });
});
