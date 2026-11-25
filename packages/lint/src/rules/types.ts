import type ts from "@typescript/typescript6";
import type { LintConfig } from "../config.ts";

export interface Finding {
  readonly rule: string;
  readonly file: string;
  readonly line: number;
  readonly message: string;
}

export interface FileContext {
  readonly root: string;
  readonly file: string;
  readonly source: ts.SourceFile;
  readonly config: LintConfig;
  readonly allFiles: ReadonlySet<string>;
}

export interface Rule {
  readonly id: string;
  readonly description: string;
  readonly check: (ctx: FileContext) => ReadonlyArray<Omit<Finding, "rule" | "file">>;
}

export interface ProjectContext {
  readonly root: string;
  readonly config: LintConfig;
  readonly allFiles: ReadonlySet<string>;
  /** Every cf-saas-lint rule id, for rules that check text naming one. */
  readonly ruleIds: ReadonlySet<string>;
}

/** A rule over the whole project's file list rather than one source file. */
export interface ProjectRule {
  readonly id: string;
  readonly description: string;
  readonly checkProject: (ctx: ProjectContext) => ReadonlyArray<Omit<Finding, "rule">>;
}
