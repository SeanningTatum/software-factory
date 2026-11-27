import ts from "@typescript/typescript6";
import { placeOf } from "../place.ts";
import type { Rule } from "./types.ts";

export const lineOf = (source: ts.SourceFile, node: ts.Node) =>
  source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;

const visit = (node: ts.Node, fn: (n: ts.Node) => void) => {
  fn(node);
  ts.forEachChild(node, (child) => visit(child, fn));
};

export const collect = (source: ts.SourceFile, match: (n: ts.Node) => string | undefined) => {
  const out: Array<{ line: number; message: string }> = [];
  visit(source, (n) => {
    const message = match(n);
    if (message) out.push({ line: lineOf(source, n), message });
  });
  return out;
};

/** The called name, whatever it is reached through: `runPromise` for `E.runPromise(...)` or `runPromise(...)`. */
const calledName = (n: ts.Node): string | undefined => {
  if (!ts.isCallExpression(n)) return undefined;
  const e = n.expression;
  if (ts.isIdentifier(e)) return e.text;
  return ts.isPropertyAccessExpression(e) ? e.name.text : undefined;
};

export const noThrow: Rule = {
  id: "no-throw",
  description: "Fail in the error channel (`return yield* new SomeError()`), not with `throw`.",
  check: ({ source }) =>
    collect(source, (n) =>
      ts.isThrowStatement(n)
        ? "use a tagged error in the Effect error channel instead of throw"
        : undefined,
    ),
};

export const noTryCatch: Rule = {
  id: "no-try-catch",
  description: "Wrap code that can throw in Effect.try / Effect.tryPromise.",
  check: ({ source }) =>
    collect(source, (n) =>
      ts.isTryStatement(n) ? "use Effect.try or Effect.tryPromise instead of try/catch" : undefined,
    ),
};

// Effect 4 adds the `…With` runners. Any mention counts, so a runner passed as a value is seen too.
const RUNNERS = /^run(Promise|Sync|Fork|Callback)(Exit)?(With)?$/;

export const noRunEffect: Rule = {
  id: "no-run-effect",
  description:
    "Only edges run effects: server functions go through runEffect, the worker through the request runtime.",
  check: ({ source }) =>
    collect(source, (n) =>
      ts.isIdentifier(n) && RUNNERS.test(n.text)
        ? `${n.text} outside an edge; return the Effect and let the edge run it`
        : undefined,
    ),
};

/** `process` or `globalThis.process`. */
const isProcess = (e: ts.Expression): boolean =>
  (ts.isIdentifier(e) && e.text === "process") ||
  (ts.isPropertyAccessExpression(e) &&
    e.name.text === "process" &&
    ts.isIdentifier(e.expression) &&
    e.expression.text === "globalThis");

/** Whether a node reads `env` off process: `.env`, `?.env`, `["env"]`, `{ env } = process`, or `import { env } from "node:process"`. */
const readsProcessEnv = (n: ts.Node): boolean => {
  if (ts.isPropertyAccessExpression(n)) return n.name.text === "env" && isProcess(n.expression);
  if (ts.isElementAccessExpression(n)) {
    const key = n.argumentExpression;
    return ts.isStringLiteralLike(key) && key.text === "env" && isProcess(n.expression);
  }
  if (ts.isVariableDeclaration(n) && n.initializer && ts.isObjectBindingPattern(n.name)) {
    const names = n.name.elements.map((el) => (el.propertyName ?? el.name).getText());
    return names.includes("env") && isProcess(n.initializer);
  }
  if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier)) {
    const bindings = n.importClause?.namedBindings;
    return (
      /^(node:)?process$/.test(n.moduleSpecifier.text) &&
      bindings !== undefined &&
      ts.isNamedImports(bindings) &&
      bindings.elements.some((el) => (el.propertyName ?? el.name).text === "env")
    );
  }
  return false;
};

export const noProcessEnv: Rule = {
  id: "no-process-env",
  description: "Workers have no process.env; read settings from the CloudflareEnv service.",
  check: ({ source }) =>
    collect(source, (n) =>
      readsProcessEnv(n)
        ? "read settings from the CloudflareEnv service, not process.env"
        : undefined,
    ),
};

const isSpanned = (node: ts.Node): boolean => {
  for (let cur: ts.Node | undefined = node.parent; cur; cur = cur.parent) {
    if (ts.isCallExpression(cur)) {
      const text = cur.expression.getText();
      if (
        /^(?:\w+\.)?fn\(\s*["'`]/.test(text) ||
        (/^(?:\w+\.)?fn$/.test(text) &&
          cur.arguments[0] &&
          ts.isStringLiteralLike(cur.arguments[0]))
      )
        return true;
      if (/\.pipe$/.test(text) && cur.arguments.some((a) => /\bwithSpan\(/.test(a.getText())))
        return true;
    }
  }
  return false;
};

export const externalCallSpan: Rule = {
  id: "external-call-span",
  description:
    'Every outside call (Effect.tryPromise) runs inside Effect.fn("name") or pipes Effect.withSpan.',
  check: ({ source }) =>
    collect(source, (n) =>
      calledName(n) === "tryPromise" && !isSpanned(n)
        ? 'wrap this outside call in Effect.fn("Name.method") or pipe Effect.withSpan(...)'
        : undefined,
    ),
};

/** Whether a yield sits inside another yield's operand, in the same generator. */
const insideYield = (node: ts.Node): boolean => {
  for (let cur = node.parent; cur && !ts.isFunctionLike(cur); cur = cur.parent)
    if (ts.isYieldExpression(cur)) return true;
  return false;
};

export const noNestedYield: Rule = {
  id: "no-nested-yield",
  description: "One yield per expression: name the service, then call it.",
  check: ({ source }) =>
    collect(source, (n) =>
      ts.isYieldExpression(n) && insideYield(n)
        ? "name the inner yield first: `const x = yield* X;` then `yield* x.method()`"
        : undefined,
    ),
};

export const fileSize: Rule = {
  id: "file-size",
  description: "Keep files small enough to read in one go.",
  check: ({ source, config }) => {
    // A final newline starts no line of its own.
    const lines = source.getLineStarts().length - (source.text.endsWith("\n") ? 1 : 0);
    return lines > config.maxLines
      ? [{ line: 1, message: `${lines} lines; split it below ${config.maxLines}` }]
      : [];
  },
};

/** `onClick={() => …}` or `onClick={function () {…}}`, parentheses and all. */
const isInlineFunction = (n: ts.Node): boolean => {
  if (!ts.isJsxAttribute(n) || !n.initializer || !ts.isJsxExpression(n.initializer)) return false;
  let e = n.initializer.expression;
  while (e && ts.isParenthesizedExpression(e)) e = e.expression;
  return e !== undefined && (ts.isArrowFunction(e) || ts.isFunctionExpression(e));
};

export const noInlineHandler: Rule = {
  id: "no-inline-handler",
  description: "Pass a named function to a JSX prop (`onClick={signOut}`), not an inline one.",
  check: ({ source }) =>
    collect(source, (n) =>
      isInlineFunction(n)
        ? "name this function above the JSX and pass it: `onClick={handleClick}`"
        : undefined,
    ),
};

const PASCAL = /^[A-Z][A-Za-z0-9]*$/;

const hasJsx = (node: ts.Node): boolean =>
  ts.isJsxElement(node) ||
  ts.isJsxSelfClosingElement(node) ||
  ts.isJsxFragment(node) ||
  ts.forEachChild(node, hasJsx) === true;

/** The function a top-level const holds, through wrappers like `memo(...)`. */
const heldFunction = (e: ts.Expression | undefined): ts.Node | undefined => {
  if (!e) return undefined;
  if (ts.isArrowFunction(e) || ts.isFunctionExpression(e)) return e;
  return ts.isCallExpression(e) ? heldFunction(e.arguments.find(ts.isFunctionLike)) : undefined;
};

/** Top-level PascalCase functions that render JSX, with the node each starts at. */
const componentsOf = (source: ts.SourceFile) =>
  source.statements.flatMap((s): Array<{ name: string; node: ts.Node }> => {
    if (ts.isFunctionDeclaration(s) && s.name && PASCAL.test(s.name.text) && hasJsx(s))
      return [{ name: s.name.text, node: s }];
    if (!ts.isVariableStatement(s)) return [];
    return s.declarationList.declarations.flatMap((d) => {
      const fn = heldFunction(d.initializer);
      return ts.isIdentifier(d.name) && PASCAL.test(d.name.text) && fn && hasJsx(fn)
        ? [{ name: d.name.text, node: d }]
        : [];
    });
  });

export const oneComponentPerFile: Rule = {
  id: "one-component-per-file",
  description: "A .tsx file declares one component; each other one gets a file of its own.",
  check: ({ file, source }) => {
    if (!file.endsWith(".tsx")) return [];
    const [first, ...rest] = componentsOf(source);
    return rest.map(({ name, node }) => ({
      line: lineOf(source, node),
      message: `${name} is a second component beside ${first?.name}; move it to its own .tsx file`,
    }));
  },
};

const isClass = (n: ts.Node) => ts.isClassDeclaration(n) || ts.isClassExpression(n);

const insideFunction = (node: ts.Node): boolean => {
  for (let cur = node.parent; cur; cur = cur.parent) if (ts.isFunctionLike(cur)) return true;
  return false;
};

export const classPlacement: Rule = {
  id: "class-placement",
  description:
    "Classes (errors, services) sit at the top of a .ts module: never in React files or components/, never inside a function.",
  check: ({ file, source }) =>
    collect(source, (n) => {
      if (!isClass(n)) return undefined;
      if (file.endsWith(".tsx") || file.includes("/components/"))
        return "no classes beside React: components are functions; put errors in the feature's errors.ts and services in api/";
      return insideFunction(n)
        ? "declare classes at the top of a module, not inside a function"
        : undefined;
    }),
};

/** The class a heritage clause extends, without type arguments or calls: `Schema.TaggedError`. */
const baseName = (e: ts.Expression): string => {
  if (ts.isCallExpression(e)) return baseName(e.expression);
  if (ts.isExpressionWithTypeArguments(e)) return baseName(e.expression);
  return ts.isPropertyAccessExpression(e) ? e.name.text : ts.isIdentifier(e) ? e.text : "";
};

const extendsError = (n: ts.ClassLikeDeclaration) =>
  (n.heritageClauses ?? []).some(
    (h) =>
      h.token === ts.SyntaxKind.ExtendsKeyword &&
      h.types.some((t) => /Error(Class)?$/.test(baseName(t.expression))),
  );

export const errorPlacement: Rule = {
  id: "error-placement",
  description:
    "Error classes live in their feature's errors.ts (src/app/errors.ts for the kernel), beside their status.",
  check: ({ file, source, config }) => {
    const place = placeOf(config.featureLayout, file);
    const home =
      place && place.kind !== "loose" && place.kind !== "lib"
        ? `${config.featureLayout.dir}/${place.folder}/errors.ts`
        : "src/app/errors.ts";
    if (file === home) return [];
    return collect(source, (n) =>
      isClass(n) && extendsError(n as ts.ClassLikeDeclaration)
        ? `move ${(n as ts.ClassLikeDeclaration).name?.text ?? "this error"} to ${home}`
        : undefined,
    );
  },
};

export const serverFnPlacement: Rule = {
  id: "server-fn-placement",
  description: "A feature's server functions live in its api/; pages only call them.",
  check: ({ file, source, config }) => {
    const place = placeOf(config.featureLayout, file);
    if (!place || place.inner.startsWith("api/")) return [];
    return collect(source, (n) =>
      calledName(n) === "createServerFn"
        ? `move this server function to ${config.featureLayout.dir}/${place.folder}/api/ and import it here`
        : undefined,
    );
  },
};

/** Whether the file can reach a machine to derive from: it imports xstate or a `*.machine.ts`. */
const importsMachine = (source: ts.SourceFile) =>
  source.statements.some(
    (s) =>
      ts.isImportDeclaration(s) &&
      ts.isStringLiteral(s.moduleSpecifier) &&
      /^(xstate|@xstate\/react)$|\.machine(\.ts)?$/.test(s.moduleSpecifier.text),
  );

/** `{ type: "START"; ... }` written as a type: an event shape. */
const isEventType = (n: ts.Node) =>
  ts.isTypeLiteralNode(n) &&
  n.members.some(
    (m) =>
      ts.isPropertySignature(m) &&
      m.name.getText() === "type" &&
      m.type !== undefined &&
      ts.isLiteralTypeNode(m.type) &&
      ts.isStringLiteral(m.type.literal),
  );

export const derivedMachineTypes: Rule = {
  id: "derived-machine-types",
  description:
    "A machine's events are declared once, in its *.machine.ts; code beside it derives them instead of writing them again.",
  check: ({ file, source }) => {
    if (file.endsWith(".machine.ts") || !importsMachine(source)) return [];
    return collect(source, (n) =>
      isEventType(n)
        ? 'derive this event type from the machine: EventFrom<typeof machine>, or ActorRefFrom<typeof machine>["send"] for send'
        : undefined,
    );
  },
};
