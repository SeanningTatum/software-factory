import { describe, expect, test } from "bun:test";
import type { BlockManifest } from "./manifest.ts";
import { withBlockPackages, withoutBlockPackages } from "./package-json.ts";

const block = (
  name: string,
  deps: Record<string, string>,
  scripts: Record<string, string> = {},
): BlockManifest => ({
  name,
  title: name,
  description: name,
  requires: [],
  packageJson: { dependencies: deps, scripts },
});

describe("package.json entries", () => {
  test("adds what blocks list and keeps versions already pinned", () => {
    const pkg = { dependencies: { "drizzle-orm": "0.40.0", react: "19" } };
    const blocks = new Map([
      ["d1", block("d1", { "drizzle-orm": "^0.45.0", zzz: "1" }, { "db:generate": "x" })],
    ]);
    const out = withBlockPackages(pkg, blocks.values());
    expect(out.dependencies).toEqual({ "drizzle-orm": "0.40.0", react: "19", zzz: "1" });
    expect(out.scripts).toEqual({ "db:generate": "x" });
  });

  test("removes only what no kept block still lists", () => {
    const pkg = { dependencies: { a: "1", shared: "1", react: "19" } };
    const out = withoutBlockPackages(
      pkg,
      [block("x", { a: "1", shared: "1" })],
      [block("y", { shared: "1" })],
    );
    expect(out.dependencies).toEqual({ shared: "1", react: "19" });
  });

  test("keeps entries the project pinned or rewrote, and adds no empty fields", () => {
    const billing = block("billing", { stripe: "^23.0.0" }, { "db:migrate": "wrangler d1" });
    const pkg = { dependencies: { stripe: "^18.0.0" }, scripts: { "db:migrate": "bash x.sh" } };
    const added = withBlockPackages(pkg, [billing]);
    expect(withoutBlockPackages(added, [billing], [])).toEqual(pkg);
  });
});
