import { readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join, relative, sep } from "node:path";
import type TS from "@typescript/typescript6";

/** A path from `path.relative` with `/` between segments, as globs and folder names expect. */
export const toSlash = (path: string, separator: string = sep) => path.split(separator).join("/");

/** Every file under `dir` as a `/` path from `root`, skipping node_modules and dotfiles. */
export const walk = (root: string, dir: string): ReadonlyArray<string> =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) return [];
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(root, path) : [toSlash(relative(root, path))];
  });

// Loaded on first use, so a tool that bundles this package but never scans (the CLI) does not
// bundle TypeScript too.
let ts: typeof TS | undefined;

/**
 * Every module a source file imports: `import`, `export … from`, side-effect imports,
 * `import x = require()`, `require()` and `import()` with a literal path. Comments and strings
 * that only look like imports are not imports.
 */
export const importSpecifiers = (text: string): ReadonlyArray<string> => {
  ts ??= createRequire(import.meta.url)("@typescript/typescript6") as typeof TS;
  return ts.preProcessFile(text, true, true).importedFiles.map((f) => f.fileName);
};

/** Test and spec files: rules that tests may break skip them, and test-only rules read only them. */
export const TEST_FILE = /\.(test|spec)\.tsx?$/;

/** Sorts strings by code unit, as `sort()` does, so output does not change with the machine's locale. */
export const byCodeUnit = (a: string, b: string) => Number(a > b) - Number(a < b);
