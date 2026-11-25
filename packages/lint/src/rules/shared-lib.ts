import ts from "@typescript/typescript6";
import { placeOf } from "../place.ts";
import type { Rule } from "./types.ts";

const REACT = /^(react|react-dom)(\/|$)|^@tanstack\/react-|\.tsx$/;
const SERVICE = /^(Context\.(Service|Tag|Reference)|Layer\.\w+)$/;

/** What a node does that a shared helper may not, or undefined. */
const offence = (n: ts.Node): string | undefined => {
  if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier)) {
    return REACT.test(n.moduleSpecifier.text)
      ? `imports React (${n.moduleSpecifier.text})`
      : undefined;
  }
  if (ts.isPropertyAccessExpression(n) && SERVICE.test(n.getText())) {
    return `uses ${n.getText()}`;
  }
  return undefined;
};

export const sharedLib: Rule = {
  id: "shared-lib",
  description:
    "core/lib holds pure helpers: plain functions and Effect functions, no services, layers or React.",
  check: ({ file, source, config }) => {
    if (placeOf(config.featureLayout, file)?.kind !== "lib") return [];
    const out: Array<{ line: number; message: string }> = [];
    const visit = (n: ts.Node) => {
      const what = offence(n);
      if (what) {
        out.push({
          line: source.getLineAndCharacterOfPosition(n.getStart(source)).line + 1,
          message: `${what}; core/lib holds pure helpers (Effect functions are fine, services, layers and React are not). Put this in a core module.`,
        });
        return;
      }
      ts.forEachChild(n, visit);
    };
    visit(source);
    return out;
  },
};
