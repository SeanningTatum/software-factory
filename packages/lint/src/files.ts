import { createRequire } from "node:module";
import { sep } from "node:path";
import type TS from "typescript";

/** A path from `path.relative` with `/` between segments, as globs and folder names expect. */
export const toSlash = (path: string, separator: string = sep) => path.split(separator).join("/");

// Loaded on first use, so a tool that bundles this package but never scans (the CLI) does not
// bundle TypeScript too.
let ts: typeof TS | undefined;

/**
 * Every module a source file imports: `import`, `export … from`, side-effect imports,
 * `import x = require()`, `require()` and `import()` with a literal path. Comments and strings
 * that only look like imports are not imports.
 */
export const importSpecifiers = (text: string): ReadonlyArray<string> => {
  ts ??= createRequire(import.meta.url)("typescript") as typeof TS;
  return ts.preProcessFile(text, true, true).importedFiles.map((f) => f.fileName);
};
