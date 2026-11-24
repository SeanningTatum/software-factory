import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, normalize, relative } from "node:path";
import { FEATURES_INDEX, featuresIndex } from "./features-index.ts";
import { devVarsExample, generateFiles } from "./generate.ts";
import { withRequirements } from "./graph.ts";
import { FEATURES_DIR, featureManifestPath, loadManifests } from "./manifest.ts";
import { packageText, withBlockPackages } from "./package-json.ts";
import { readProject, writeProject } from "./project.ts";
import { scanFeature } from "./scan.ts";
import { TIMELINE_FILE, timelinePath, timelineSection, timelineText } from "./timeline.ts";
import { patchWrangler, WRANGLER_FILE } from "./wrangler.ts";

const DEV_VARS_EXAMPLE = ".dev.vars.example";

const read = (path: string) => (existsSync(path) ? readFileSync(path, "utf8") : undefined);

/** Each feature's TIMELINE.md with a fresh generated block, plus the FEATURES.md index. */
const docs = (root: string, manifests: ReturnType<typeof loadManifests>) => {
  const out = new Map<string, string>();
  for (const [name, manifest] of manifests) {
    const section = timelineSection(root, manifests, manifest, scanFeature(root, name));
    out.set(timelinePath(name), timelineText(read(join(root, timelinePath(name))), section));
  }
  out.set(FEATURES_INDEX, featuresIndex(manifests));
  return out;
};

/** Every file `sync` would write, with its new contents. */
export const plan = (root: string) => {
  const manifests = loadManifests(root);
  const project = readProject(root);
  const files = new Map(generateFiles(root, manifests));
  files.set(DEV_VARS_EXAMPLE, devVarsExample(manifests));
  for (const [path, text] of docs(root, manifests)) files.set(path, text);
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

/** Every file under `dir`, skipping node_modules and dotfiles. */
const walk = (dir: string): ReadonlyArray<string> => {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) return [];
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
};

/** The app's own folder: request context, runtime, errors, middleware. Not a feature. */
export const APP_DIR = "src/app";
/** Files at the top of src that belong to the app. */
export const APP_FILES: ReadonlyArray<string> = [
  "src/routes/__root.tsx",
  "src/start.ts",
  "src/router.tsx",
  "src/server.ts",
  "src/styles.css",
];

/**
 * Who owns a path under src: a feature's name, "app" for the kernel and the files at the top of
 * src, "gen" for generated files, or undefined for a file that has no place.
 */
export const ownerOf = (path: string): string | undefined => {
  const feature = /^src\/features\/([^/]+)\//.exec(path);
  if (feature?.[1]) return feature[1];
  if (path.startsWith("src/gen/") || path === "src/routeTree.gen.ts") return "gen";
  if (path.startsWith(`${APP_DIR}/`) || APP_FILES.includes(path)) return "app";
  return undefined;
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

type Manifests = ReturnType<typeof loadManifests>;

/** Why `owner` may not import `target`, or undefined when it may. */
const crossing = (manifests: Manifests, owner: string, target: string): string | undefined => {
  if (target === "app" || target === "gen" || target === owner) return undefined;
  if (manifests.get(target)?.core) return undefined;
  if (owner === "app") {
    return `the app imports feature "${target}"; src/app and the files at the top of src may import only the app, src/gen and core features`;
  }
  if (manifests.get(owner)?.core) {
    return `core feature "${owner}" imports feature "${target}"; core features may import only the app, src/gen and core features`;
  }
  if (withRequirements(manifests, [owner]).includes(target)) return undefined;
  return `feature "${owner}" imports feature "${target}" without listing it in "requires"`;
};

const importProblems = (root: string, manifests: Manifests, file: string, owner: string) => {
  const problems: Array<Problem> = [];
  const text = readFileSync(join(root, file), "utf8");
  for (const match of text.matchAll(IMPORT)) {
    const spec = match[1] ?? match[2];
    const target = spec ? resolveImport(root, file, spec) : undefined;
    const targetOwner = target ? ownerOf(target) : undefined;
    const message = targetOwner ? crossing(manifests, owner, targetOwner) : undefined;
    if (message) problems.push({ file, message: `${message} (${spec})` });
  }
  return problems;
};

/** Files with no owner, and imports that cross a feature boundary the manifests don't allow. */
export const boundaryProblems = (root: string): ReadonlyArray<Problem> => {
  const manifests = loadManifests(root);
  const problems: Array<Problem> = [];
  for (const file of walk(join(root, "src")).map((f) => relative(root, f))) {
    const owner = ownerOf(file);
    if (owner === "gen") continue;
    if (owner === undefined) {
      problems.push({
        file,
        message: `has no owner; move it into ${APP_DIR} or a feature under ${FEATURES_DIR}`,
      });
      continue;
    }
    if (owner !== "app" && !manifests.has(owner)) {
      problems.push({
        file,
        message: `belongs to feature "${owner}", which has no ${featureManifestPath(owner)}`,
      });
      continue;
    }
    if (SOURCE.test(file)) problems.push(...importProblems(root, manifests, file, owner));
  }
  return problems;
};

const staleMessage = (path: string, exists: boolean) => {
  if (!exists) return "missing; run `bun run blocks:sync` to write it";
  if (path.endsWith(`/${TIMELINE_FILE}`)) {
    return "generated block out of date; run `bun run blocks:sync` (never edit between the generated markers)";
  }
  return "out of date; run `bun run blocks:sync`";
};

/** Stale generated files plus boundary problems. An empty list means the project is in order. */
export const check = (root: string): ReadonlyArray<Problem> => {
  const { files } = plan(root);
  const stale: Array<Problem> = [];
  for (const [path, text] of files) {
    const current = read(join(root, path));
    if (current !== text)
      stale.push({ file: path, message: staleMessage(path, current !== undefined) });
  }
  return [...stale, ...boundaryProblems(root)];
};
