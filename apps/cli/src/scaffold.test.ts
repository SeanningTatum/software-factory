import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hasTables, parseFeatures, scaffold, titleCase, validateName } from "./scaffold.ts";

const TEMPLATE = join(import.meta.dirname, "../template");
const HARNESS = join(import.meta.dirname, "../harness");

const target = () => {
  const dir = mkdtempSync(join(tmpdir(), "scaffold-"));
  rmSync(dir, { recursive: true });
  return dir;
};

describe("scaffold", () => {
  test("keeps the chosen features and what they require, and names the project", () => {
    const dir = target();
    const result = scaffold({
      templateDir: TEMPLATE,
      harnessDir: HARNESS,
      targetDir: dir,
      name: "acme-app",
      features: ["billing"],
    });
    expect(result.features).toEqual(["db", "auth", "billing"]);
    expect(existsSync(join(dir, "src/features/kv"))).toBe(false);
    expect(existsSync(join(dir, "src/features/uploads"))).toBe(false);
    expect(existsSync(join(dir, "src/features/ui"))).toBe(true);
    expect(hasTables(dir)).toBe(true);
    expect(existsSync(join(dir, ".gitignore"))).toBe(true);
    expect(JSON.parse(readFileSync(join(dir, "package.json"), "utf8")).name).toBe("acme-app");
    const wrangler = readFileSync(join(dir, "wrangler.jsonc"), "utf8");
    expect(wrangler).toContain('"name": "acme-app"');
    expect(wrangler).toContain("acme-app-db-staging");
    expect(wrangler).not.toContain("UPLOAD_LIMITER");
    expect(readFileSync(join(dir, "src/routes/__root.tsx"), "utf8")).toContain(
      'APP_NAME = "Acme App"',
    );
    expect(readFileSync(join(dir, ".dev.vars"), "utf8")).toMatch(/^BETTER_AUTH_SECRET=\S{32,}$/m);
  });

  test("leaves no trace of removed features in generated files or package.json", () => {
    const dir = target();
    scaffold({
      templateDir: TEMPLATE,
      harnessDir: undefined,
      targetDir: dir,
      name: "bare",
      features: [],
    });
    const gen = [
      "layers",
      "errors",
      "events",
      "nav",
      "auth-plugins",
      "workflows",
      "viewer",
      "env",
      "routes",
    ]
      .map((f) => readFileSync(join(dir, `src/gen/${f}.ts`), "utf8"))
      .join("\n");
    for (const name of ["db", "auth", "billing", "kv", "workflows", "uploads"])
      expect(gen).not.toContain(`features/${name}/`);
    expect(hasTables(dir)).toBe(false);
    const index = readFileSync(join(dir, "FEATURES.md"), "utf8");
    expect(index.match(/^- \*\*/gm)?.length).toBe(5);
    expect(index).not.toContain("(optional)");
    const pkg = readFileSync(join(dir, "package.json"), "utf8");
    for (const dep of ["better-auth", "drizzle-orm", "stripe", "db:generate"])
      expect(pkg).not.toContain(dep);
    expect(existsSync(join(dir, "drizzle.config.ts"))).toBe(false);
    expect(existsSync(join(dir, ".claude"))).toBe(false);
  });

  test("copies the harness and locks it", () => {
    const dir = target();
    scaffold({
      templateDir: TEMPLATE,
      harnessDir: HARNESS,
      targetDir: dir,
      name: "with-harness",
      features: [],
    });
    expect(existsSync(join(dir, ".claude/settings.json"))).toBe(true);
    expect(
      JSON.parse(readFileSync(join(dir, "harness.lock.json"), "utf8")).files["settings.json"],
    ).toMatch(/^[0-9a-f]{64}$/);
  });

  test("starts each feature's History and keeps its Decisions", () => {
    const dir = target();
    scaffold({
      templateDir: TEMPLATE,
      harnessDir: undefined,
      targetDir: dir,
      name: "dated",
      features: ["kv"],
      date: "2030-01-02",
    });
    const kv = readFileSync(join(dir, "src/features/kv/TIMELINE.md"), "utf8");
    const history = kv.slice(kv.indexOf("## History"));
    expect(history.match(/^- \d{4}/gm)).toEqual(["- 2030"]);
    expect(history).toMatch(
      /^- 2030-01-02 — Created from create-tanstack-cf-saas \d+\.\d+\.\d+\.$/m,
    );
    expect(history).not.toContain("src/blocks");
    expect(kv.slice(kv.indexOf("## Decisions"), kv.indexOf("## History"))).toContain("Why:");
    expect(kv).toContain("<!-- generated:end -->");
  });

  test("accepts the old block names d1 and r2", () => {
    const dir = target();
    const result = scaffold({
      templateDir: TEMPLATE,
      harnessDir: undefined,
      targetDir: dir,
      name: "old-names",
      features: ["r2"],
    });
    expect(result.features).toEqual(["db", "auth", "uploads"]);
  });

  test("refuses a bad name, an unknown feature and a non-empty folder", () => {
    expect(() =>
      scaffold({
        templateDir: TEMPLATE,
        harnessDir: undefined,
        targetDir: target(),
        name: "Bad Name",
        features: [],
      }),
    ).toThrow(/lowercase/);
    expect(() =>
      scaffold({
        templateDir: TEMPLATE,
        harnessDir: undefined,
        targetDir: target(),
        name: "ok",
        features: ["nope"],
      }),
    ).toThrow(/Unknown feature/);
    expect(() =>
      scaffold({
        templateDir: TEMPLATE,
        harnessDir: undefined,
        targetDir: import.meta.dirname,
        name: "ok",
        features: [],
      }),
    ).toThrow(/not empty/);
  });
});

describe("parseFeatures", () => {
  test("splits, trims, drops repeats and maps old names with a note", () => {
    expect(parseFeatures(" d1, auth,,r2,db ")).toEqual({
      features: ["db", "auth", "uploads"],
      notes: ['"d1" is now called "db".', '"r2" is now called "uploads".'],
    });
    expect(parseFeatures("")).toEqual({ features: [], notes: [] });
  });
});

describe("names", () => {
  test("validates and title-cases", () => {
    expect(validateName("my-app")).toBeUndefined();
    expect(validateName("-x")).toBeDefined();
    expect(titleCase("my-cool-app")).toBe("My Cool App");
  });
});
