import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scaffold, titleCase, validateName } from "./scaffold.ts";

const TEMPLATE = join(import.meta.dirname, "../template");
const HARNESS = join(import.meta.dirname, "../harness");

const target = () => {
  const dir = mkdtempSync(join(tmpdir(), "scaffold-"));
  rmSync(dir, { recursive: true });
  return dir;
};

describe("scaffold", () => {
  test("keeps the chosen blocks and what they require, and names the project", () => {
    const dir = target();
    const result = scaffold({ templateDir: TEMPLATE, harnessDir: HARNESS, targetDir: dir, name: "acme-app", blocks: ["billing"] });
    expect(result.blocks).toEqual(["d1", "auth", "billing"]);
    expect(existsSync(join(dir, "src/blocks/kv"))).toBe(false);
    expect(existsSync(join(dir, "src/routes/(r2)"))).toBe(false);
    expect(existsSync(join(dir, "e2e/r2"))).toBe(false);
    expect(existsSync(join(dir, ".gitignore"))).toBe(true);
    expect(JSON.parse(readFileSync(join(dir, "package.json"), "utf8")).name).toBe("acme-app");
    const wrangler = readFileSync(join(dir, "wrangler.jsonc"), "utf8");
    expect(wrangler).toContain('"name": "acme-app"');
    expect(wrangler).toContain("acme-app-db-staging");
    expect(wrangler).not.toContain("UPLOAD_LIMITER");
    expect(readFileSync(join(dir, "src/routes/__root.tsx"), "utf8")).toContain('APP_NAME = "Acme App"');
    expect(readFileSync(join(dir, ".dev.vars"), "utf8")).toMatch(/^BETTER_AUTH_SECRET=\S{32,}$/m);
  });

  test("leaves no trace of removed blocks in generated files or package.json", () => {
    const dir = target();
    scaffold({ templateDir: TEMPLATE, harnessDir: undefined, targetDir: dir, name: "bare", blocks: [] });
    const gen = ["layers", "errors", "events", "nav", "auth-plugins", "workflows", "viewer", "env"]
      .map((f) => readFileSync(join(dir, `src/gen/${f}.ts`), "utf8"))
      .join("\n");
    expect(gen).not.toContain("blocks/");
    const pkg = readFileSync(join(dir, "package.json"), "utf8");
    for (const dep of ["better-auth", "drizzle-orm", "stripe", "db:generate"]) expect(pkg).not.toContain(dep);
    expect(existsSync(join(dir, "drizzle.config.ts"))).toBe(false);
    expect(existsSync(join(dir, ".claude"))).toBe(false);
  });

  test("copies the harness and locks it", () => {
    const dir = target();
    scaffold({ templateDir: TEMPLATE, harnessDir: HARNESS, targetDir: dir, name: "with-harness", blocks: [] });
    expect(existsSync(join(dir, ".claude/settings.json"))).toBe(true);
    expect(JSON.parse(readFileSync(join(dir, "harness.lock.json"), "utf8")).files["settings.json"]).toMatch(/^[0-9a-f]{64}$/);
  });

  test("refuses a bad name, an unknown block and a non-empty folder", () => {
    expect(() => scaffold({ templateDir: TEMPLATE, harnessDir: undefined, targetDir: target(), name: "Bad Name", blocks: [] })).toThrow(/lowercase/);
    expect(() => scaffold({ templateDir: TEMPLATE, harnessDir: undefined, targetDir: target(), name: "ok", blocks: ["nope"] })).toThrow(/Unknown block/);
    expect(() => scaffold({ templateDir: TEMPLATE, harnessDir: undefined, targetDir: import.meta.dirname, name: "ok", blocks: [] })).toThrow(/not empty/);
  });
});

describe("names", () => {
  test("validates and title-cases", () => {
    expect(validateName("my-app")).toBeUndefined();
    expect(validateName("-x")).toBeDefined();
    expect(titleCase("my-cool-app")).toBe("My Cool App");
  });
});
