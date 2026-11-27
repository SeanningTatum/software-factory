import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "@typescript/typescript6";
import { byCodeUnit } from "../files.ts";
import { matchesAny } from "../glob.ts";
import type { ProjectRule, Rule } from "./types.ts";

interface Comment {
  readonly line: number;
  endLine: number;
  readonly single: boolean;
  text: string;
}

/**
 * Every comment in a file without its markers. With `merge`, a run of `//` lines on consecutive
 * lines is one comment, so commented-out code and repeated blocks are seen whole.
 */
const commentsOf = (source: ts.SourceFile, merge: boolean): ReadonlyArray<Comment> => {
  const text = source.text;
  const ranges = new Map<number, ts.CommentRange>();
  const add = (found: ReadonlyArray<ts.CommentRange> | undefined) => {
    for (const r of found ?? []) ranges.set(r.pos, r);
  };
  const visit = (n: ts.Node) => {
    add(ts.getLeadingCommentRanges(text, n.getFullStart()));
    add(ts.getTrailingCommentRanges(text, n.end));
    for (const child of n.getChildren(source)) visit(child);
  };
  visit(source);
  const out: Comment[] = [];
  for (const r of [...ranges.values()].sort((a, b) => a.pos - b.pos)) {
    const raw = text.slice(r.pos, r.end);
    const line = source.getLineAndCharacterOfPosition(r.pos).line + 1;
    const endLine = source.getLineAndCharacterOfPosition(r.end).line + 1;
    const single = r.kind === ts.SyntaxKind.SingleLineCommentTrivia;
    const body = single
      ? raw.slice(2)
      : raw
          .slice(2, -2)
          .split("\n")
          .map((l) => l.replace(/^\s*\*(?!\*)/, ""))
          .join("\n");
    const last = out.at(-1);
    if (merge && single && last?.single && line === last.endLine + 1) {
      last.text += `\n${body}`;
      last.endLine = endLine;
    } else out.push({ line, endLine, single, text: body });
  }
  return out;
};

/** Comments that talk to a tool, not to a reader. */
const DIRECTIVE = /^\s*(\/\s*<|biome-ignore|@ts-|eslint-)/;
const MARKER = /\b(TODO|FIXME|XXX|HACK)\b/;
const DIVIDER = /([-=*#~_])\1{3,}/;
/** Prose that parses as code: it quotes code in backticks, or opens with `note:` or `e.g.`. */
const PROSE = /`|^\s*(e\.g\.|i\.e\.|[A-Za-z]+:\s)/;
const CODE_HINT = /[;{}=]|\)[ \t]*$|^[ \t]*(import|export|const|let|return|await|if|for)\b/m;

const parses = (code: string) =>
  ts.transpileModule(code, {
    reportDiagnostics: true,
    fileName: "comment.tsx",
    compilerOptions: { jsx: ts.JsxEmit.Preserve },
  }).diagnostics?.length === 0;

/** What is wrong with one comment as written, or nothing. */
const lineProblem = (text: string): string | undefined => {
  if (DIRECTIVE.test(text)) return undefined;
  if (!text.trim()) return "delete the empty comment";
  if (MARKER.test(text))
    return "put open work in the backlog or an issue; for a known limit write `shortcut: <limit>, <when to fix>`";
  if (DIVIDER.test(text)) return "drop the divider; split the file if it needs sections";
  return undefined;
};

const isCode = (text: string) =>
  !DIRECTIVE.test(text) && !PROSE.test(text) && CODE_HINT.test(text) && parses(text);

export const noUselessComment: Rule = {
  id: "no-useless-comment",
  description: "No commented-out code, TODO markers, dividers or empty comments.",
  check: ({ source }) => {
    const code = commentsOf(source, true)
      .filter((c) => isCode(c.text))
      .map((c) => ({ line: c.line, message: "delete the commented-out code; git keeps it" }));
    const lines = commentsOf(source, false).flatMap((c) => {
      const message = lineProblem(c.text);
      return message ? [{ line: c.line, message }] : [];
    });
    return [...code, ...lines].sort((a, b) => a.line - b.line);
  },
};

const ALLOW = "software-factory-lint allow comments";

const lineOf = (source: ts.SourceFile, pos: number) =>
  source.getLineAndCharacterOfPosition(pos).line + 1;

export const noComment: Rule = {
  id: "no-comment",
  description: `No comments, unless the file opens with \`// ${ALLOW}\`.`,
  check: ({ source }) => {
    const prose = commentsOf(source, false).filter((c) => !DIRECTIVE.test(c.text));
    const first = source.statements[0];
    const codeStarts = first ? lineOf(source, first.getStart()) : Number.POSITIVE_INFINITY;
    const opener = prose[0];
    if (opener?.text.trim() === ALLOW && opener.line < codeStarts)
      return prose.length > 1
        ? []
        : [{ line: opener.line, message: "delete this line: the file has no comments to allow" }];
    const message = `delete the comment, or open the file with \`// ${ALLOW}\` to keep its comments`;
    return prose.map((c) => ({ line: c.line, message }));
  },
};

/** Short comments ("as above") may repeat; a sentence said twice goes stale in one place. */
const MIN_WORDS = 5;

export const noDuplicateComment: ProjectRule = {
  id: "no-duplicate-comment",
  description: "Say a thing once: the same comment in two places goes stale in one of them.",
  checkProject: ({ root, config, allFiles }) => {
    const first = new Map<string, string>();
    const files = [...allFiles]
      .filter((f) => matchesAny(f, config.include) && !matchesAny(f, config.exclude))
      .sort(byCodeUnit);
    return files.flatMap((file) => {
      const text = readFileSync(join(root, file), "utf8");
      const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
      return commentsOf(source, true).flatMap((c) => {
        const key = c.text.replace(/\s+/g, " ").trim().toLowerCase();
        if (DIRECTIVE.test(c.text) || key.split(" ").length < MIN_WORDS) return [];
        const seen = first.get(key);
        if (!seen) first.set(key, `${file}:${c.line}`);
        return seen ? [{ file, line: c.line, message: `same comment as ${seen}; keep one` }] : [];
      });
    });
  },
};
