import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { timelinePath } from "@tanstack-cf-saas/blocks";

const HISTORY = "## History";
/** Where the History section stops: the next heading or marked block. */
const NEXT = /\n(?:## |<!-- (?:generated|machines):start -->)/;

export const today = () => new Date().toISOString().slice(0, 10);

/**
 * TIMELINE.md with its History replaced by `line`. Decisions stay, since they explain the code
 * that ships; History is this repo's, not the new project's. The guide comment under the heading
 * and anything after the section are kept.
 */
export const freshHistory = (text: string, line: string): string => {
  const at = text.indexOf(`\n${HISTORY}\n`);
  if (at < 0) return `${text.trimEnd()}\n\n${HISTORY}\n\n${line}\n`;
  const start = at + HISTORY.length + 2;
  const body = text.slice(start);
  const next = NEXT.exec(body);
  const section = next ? body.slice(0, next.index) : body;
  const tail = next ? body.slice(next.index) : "";
  const comment = /^\s*(<!--[\s\S]*?-->)/.exec(section)?.[1];
  return `${text.slice(0, start)}\n${comment ? `${comment}\n\n` : ""}${line}\n${tail}`;
};

/** Gives each feature's TIMELINE.md a History of one line. */
export const resetHistory = (root: string, features: ReadonlyArray<string>, line: string) => {
  for (const name of features) {
    const path = join(root, timelinePath(name));
    if (existsSync(path)) writeFileSync(path, freshHistory(readFileSync(path, "utf8"), line));
  }
};
