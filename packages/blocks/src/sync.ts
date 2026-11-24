import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, normalize, relative } from "node:path";
import { devVarsExample, generateFiles } from "./generate.ts";
import { withRequirements } from "./graph.ts";
import { BLOCKS_DIR, loadManifests } from "./manifest.ts";
import { packageText, withBlockPackages } from "./package-json.ts";
import { readProject, writeProject } from "./project.ts";
import { patchWrangler, WRANGLER_FILE } from "./wrangler.ts";

const DEV_VARS_EXAMPLE = ".dev.vars.example";

/** Every file `sync` would write, with its new contents. */
export const plan = (root: string) => {
  const manifests = loadManifests(root);
  const project = readProject(root);
  const files = new Map(generateFiles(root, manifests));
  files.set(DEV_VARS_EXAMPLE, devVarsExample(manifests));
  const wranglerPath = join(root, WRANGLER_FILE);
  const wrangler = patchWrangler(readFileSync(wranglerPath, "utf8"), {
    project: project.name,
    manifests,
    previouslyManaged: project.managed,
  });
  files.set(WRANGLER_FILE, wrangler.text);
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  files.set("package.json", packageText(withBlockPackages(pkg, manifests.values())));
  return { manifests, project: { ...project, managed: wrangler.managed }, files };
};

const read = (path: string) => (existsSync(path) ? readFileSync(path, "utf8") : undefined);

/** Writes the generated files, patches wrangler.jsonc and records what the tool manages. */
export const sync = (root: string): ReadonlyArray<string> => {
  const { project, files } = plan(root);
  const changed: Array<string> = [];
  for (const [path, text] of files) {
    const full = join(root, path);
    if (read(full) === text) continue;
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, text);
    changed.push(path);
  }
  writeProject(root, project);
  return changed;
};

const SOURCE = /\.(ts|tsx)$/;
const IMPORT = /(?:import|export)[^"'`]*?from\s*["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g;

const walk = (dir: string): ReadonlyArray<string> => {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "node_modules" ? [] : walk(path);
    return SOURCE.test(entry.name) ? [path] : [];
  });
};

/** Which block a project path belongs to, or "core". Generated files belong to no one. */
export const ownerOf = (path: string): string => {
  const block = /^src\/blocks\/([^/]+)\//.exec(path) ?? /^src\/routes\/\(([^)]+)\)\//.exec(path) ?? /^e2e\/([^/]+)\//.exec(path);
  if (block?.[1] && !(path.startsWith("e2e/") && !path.slice(4).includes("/"))) return block[1];
  if (path.startsWith("src/gen/") || path === "src/routeTree.gen.ts") return "gen";
  return "core";
};

const resolveImport = (root: string, file: string, spec: string): string | undefined => {
  if (spec.startsWith("#/")) return `src/${spec.slice(2)}`;
  if (spec.startsWith(".")) return relative(root, normalize(join(dirname(join(root, file)), spec)));
  return undefined;
};

export interface Problem {
  readonly file: string;
  readonly message: string;
}

/** Imports that cross a block boundary the manifests don't allow. */
export const boundaryProblems = (root: string): ReadonlyArray<Problem> => {
  const manifests = loadManifests(root);
  const problems: Array<Problem> = [];
  const files = [...walk(join(root, "src")), ...walk(join(root, "e2e"))].map((f) => relative(root, f));
  for (const file of files) {
    const owner = ownerOf(file);
    if (owner === "gen") continue;
    if (owner !== "core" && !manifests.has(owner)) {
      problems.push({ file, message: `belongs to block "${owner}", which has no ${BLOCKS_DIR}/${owner}/block.json` });
      continue;
    }
    const allowed = owner === "core" ? [] : withRequirements(manifests, [owner]);
    const text = readFileSync(join(root, file), "utf8");
    for (const match of text.matchAll(IMPORT)) {
      const spec = match[1] ?? match[2];
      const target = spec ? resolveImport(root, file, spec) : undefined;
      if (!target) continue;
      const targetOwner = ownerOf(target);
      if (targetOwner === "core" || targetOwner === "gen" || targetOwner === owner) continue;
      if (owner === "core") {
        problems.push({ file, message: `core imports block "${targetOwner}" (${spec}); core must work with no blocks` });
      } else if (!allowed.includes(targetOwner)) {
        problems.push({
          file,
          message: `block "${owner}" imports block "${targetOwner}" (${spec}) without listing it in "requires"`,
        });
      }
    }
  }
  return problems;
};

/** Stale generated files plus boundary problems. An empty list means the project is in order. */
export const check = (root: string): ReadonlyArray<Problem> => {
  const { files } = plan(root);
  const stale: Array<Problem> = [];
  for (const [path, text] of files) {
    if (read(join(root, path)) !== text) {
      stale.push({ file: path, message: "out of date; run `bun run blocks:sync`" });
    }
  }
  return [...stale, ...boundaryProblems(root)];
};
