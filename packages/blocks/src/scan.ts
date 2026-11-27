import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { byCodeUnit } from "@tanstack-cf-saas/lint";
import { ROUTES_DIR } from "./generate.ts";

/** What a feature's source declares, read from the text alone: nothing is imported or run. */
export interface FeatureScan {
  /** URL paths its `routes/` folder serves. */
  readonly routes: ReadonlyArray<string>;
  /** Exported `Context.Service` classes. */
  readonly services: ReadonlyArray<string>;
  /** Exported tagged error classes. */
  readonly errors: ReadonlyArray<string>;
  /** Analytics event names from its `events.ts`. */
  readonly events: ReadonlyArray<string>;
  /** Its `*.machine.ts` files, as paths inside the feature. */
  readonly machines: ReadonlyArray<string>;
}

const files = (dir: string, prefix = ""): ReadonlyArray<string> =>
  existsSync(dir)
    ? readdirSync(dir, { withFileTypes: true })
        .flatMap((entry) => {
          if (entry.name.startsWith(".") || entry.name === "node_modules") return [];
          const path = `${prefix}${entry.name}`;
          return entry.isDirectory() ? files(join(dir, entry.name), `${path}/`) : [path];
        })
        .sort(byCodeUnit)
    : [];

const SOURCE = /\.tsx?$/;
const TEST = /\.(test|spec)\.tsx?$/;
const SERVICE = /export\s+class\s+(\w+)\s+extends\s+Context\.(?:Service|Tag)\b/g;
const ERROR = /export\s+class\s+(\w+)\s+extends\s+(?:Schema|Data)\.TaggedError\b/g;
const EVENT = /Schema\.TaggedStruct\(\s*["'`]([^"'`]+)["'`]/g;

const unique = (items: Iterable<string>) => [...new Set(items)].sort(byCodeUnit);
const captures = (text: string, re: RegExp) => [...text.matchAll(re)].flatMap((m) => m[1] ?? []);

/**
 * The URL path a TanStack file route serves, or undefined for a file that is not a route: tests,
 * `-` prefixed files and pathless `_layout` files. `index` and `(group)` segments add nothing.
 */
export const routePath = (file: string): string | undefined => {
  if (!SOURCE.test(file) || TEST.test(file)) return undefined;
  const segments = file
    .replace(SOURCE, "")
    .split("/")
    .flatMap((s) => s.split("."));
  const last = segments.at(-1) ?? "";
  if (segments.some((s) => s.startsWith("-")) || last.startsWith("_")) return undefined;
  const parts = segments
    .filter((s) => s !== "index" && s !== "route" && !s.startsWith("_") && !/^\(.*\)$/.test(s))
    .map((s) => s.replace(/_$/, ""));
  return `/${parts.join("/")}`;
};

/** Reads a feature folder's routes, services, errors, events and machines. `dir` is from the root. */
export const scanFeature = (root: string, featureDir: string): FeatureScan => {
  const dir = join(root, featureDir);
  const all = files(dir);
  const sources = all.filter((f) => SOURCE.test(f) && !TEST.test(f) && !f.startsWith("e2e/"));
  const texts = sources.map((f) => readFileSync(join(dir, f), "utf8"));
  const events = all.includes("events.ts") ? readFileSync(join(dir, "events.ts"), "utf8") : "";
  return {
    routes: unique(
      files(join(dir, ROUTES_DIR)).flatMap((f) => {
        const path = routePath(f);
        return path ? [path] : [];
      }),
    ),
    services: unique(texts.flatMap((t) => captures(t, SERVICE))),
    errors: unique(texts.flatMap((t) => captures(t, ERROR))),
    events: unique(captures(events, EVENT)),
    machines: sources.filter((f) => f.endsWith(".machine.ts")),
  };
};
