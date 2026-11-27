import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "@typescript/typescript6";
import { byCodeUnit } from "../files.ts";
import { matchesAny } from "../glob.ts";
import type { ProjectRule } from "./types.ts";

const API_PATH = /^\/api\/[\w\-./$]+$/;
const TEST_FILE = /\.(test|spec)\.tsx?$/;

/** `createFileRoute("/api/x")` declares the route; the router needs the literal there. */
const declaresRoute = (n: ts.Node) =>
  ts.isCallExpression(n.parent) &&
  ts.isIdentifier(n.parent.expression) &&
  n.parent.expression.text === "createFileRoute";

const pathsIn = (source: ts.SourceFile) => {
  const out: Array<{ path: string; line: number }> = [];
  const visit = (n: ts.Node) => {
    if (ts.isStringLiteralLike(n) && API_PATH.test(n.text) && !declaresRoute(n)) {
      const line = source.getLineAndCharacterOfPosition(n.getStart(source)).line + 1;
      out.push({ path: n.text, line });
    }
    ts.forEachChild(n, visit);
  };
  visit(source);
  return out;
};

export const noRepeatedApiPath: ProjectRule = {
  id: "no-repeated-api-path",
  description:
    "Write each /api/ path once, in its feature's constants.ts; a copy elsewhere breaks silently on a rename.",
  checkProject: ({ root, config, allFiles }) => {
    const allowed = config.allow["no-repeated-api-path"] ?? [];
    const files = [...allFiles]
      .filter((f) => matchesAny(f, config.include) && !matchesAny(f, config.exclude))
      .filter((f) => !TEST_FILE.test(f) && !matchesAny(f, allowed))
      .sort(byCodeUnit);
    const seen = new Map<string, Array<{ file: string; line: number }>>();
    for (const file of files) {
      const text = readFileSync(join(root, file), "utf8");
      const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
      for (const { path, line } of pathsIn(source))
        seen.set(path, [...(seen.get(path) ?? []), { file, line }]);
    }
    return [...seen].flatMap(([path, at]) => {
      const where = new Set(at.map((a) => a.file));
      if (where.size < 2) return [];
      return at.map(({ file, line }) => ({
        file,
        line,
        message: `"${path}" is also in ${[...where].filter((f) => f !== file).join(", ")}; export it once from the feature's constants.ts`,
      }));
    });
  },
};
