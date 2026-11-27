import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ProjectRule } from "./types.ts";

const FILE = "CLAUDE.md";

/**
 * Backticked tokens CLAUDE.md names as a path, a script or a rule. A path has a `/`, no space and
 * no `<`, `*` or `{`; it is checked only when its first segment exists at the root, so relative
 * names like `routes/api/` and the files each feature owns are left alone.
 */
const TOKEN = /`([^`\n]+)`/g;
const SCRIPT = /^bun run ([\w:-]+)$/;
const RULE = /rules? $/;

/** A route (`/api/health`) or a relative path (`../x`) is not a project path. */
const PATH = /^[^\s<*{/.][^\s<*{/]*\/[^\s<*{]*$/;

/** What is untrue about one backticked token, or nothing. `before` is the text just ahead of it. */
const untrue = (
  root: string,
  token: string,
  before: string,
  scripts: Record<string, unknown> | undefined,
  ruleIds: ReadonlySet<string>,
): string | undefined => {
  const script = SCRIPT.exec(token)?.[1];
  if (script) {
    return scripts && !(script in scripts)
      ? `\`${token}\`: package.json has no script "${script}"`
      : undefined;
  }
  if (RULE.test(before)) {
    return ruleIds.has(token) ? undefined : `rule \`${token}\` is not a cf-saas-lint rule`;
  }
  const top = token.split("/")[0] ?? "";
  return PATH.test(token) && existsSync(join(root, top)) && !existsSync(join(root, token))
    ? `\`${token}\` does not exist`
    : undefined;
};

/** Agents read CLAUDE.md first and in full; past the limit, rules get skimmed. */
export const rulesFile: ProjectRule = {
  id: "rules-file",
  description: `Keep ${FILE} short and true: under the line limit, naming only paths, scripts and rules that exist.`,
  checkProject: ({ root, config, allFiles, ruleIds }) => {
    if (!allFiles.has(FILE)) return [];
    const text = readFileSync(join(root, FILE), "utf8").trimEnd();
    const count = text.split("\n").length;
    const found = (line: number, message: string) => ({ file: FILE, line, message });
    const scripts = allFiles.has("package.json")
      ? JSON.parse(readFileSync(join(root, "package.json"), "utf8")).scripts
      : undefined;
    const limit =
      count > config.maxRulesLines
        ? [
            found(
              config.maxRulesLines + 1,
              `${count} lines; keep it to ${config.maxRulesLines} by moving detail into the check that enforces it`,
            ),
          ]
        : [];
    const wrong = [...text.matchAll(TOKEN)].flatMap((m) => {
      const message = untrue(
        root,
        m[1] ?? "",
        text.slice(Math.max(0, m.index - 6), m.index),
        scripts,
        ruleIds,
      );
      return message ? [found(text.slice(0, m.index).split("\n").length, message)] : [];
    });
    return [...limit, ...wrong];
  },
};
