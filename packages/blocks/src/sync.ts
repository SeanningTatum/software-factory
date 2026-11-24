import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, normalize, posix, relative } from "node:path";
import { importSpecifiers, TIMELINE_FILE, toSlash } from "@tanstack-cf-saas/lint";
import { FEATURES_INDEX, featuresIndex } from "./features-index.ts";
import { devVarsExample, generateFiles } from "./generate.ts";
import { withRequirements } from "./graph.ts";
import {
  CORE_DIR,
  FEATURES_DIR,
  type Features,
  isCoreModule,
  loadManifests,
  MANIFEST_FILE,
  SHARED_LIB_DIR,
} from "./manifest.ts";
import { packageText, withBlockPackages } from "./package-json.ts";
import { readProject, writeProject } from "./project.ts";
import { scanFeature } from "./scan.ts";
import { timelinePath, timelineSection, timelineText } from "./timeline.ts";
import { patchWrangler, WRANGLER_FILE } from "./wrangler.ts";

const DEV_VARS_EXAMPLE = ".dev.vars.example";

const read = (path: string) => (existsSync(path) ? readFileSync(path, "utf8") : undefined);

/** Each feature's TIMELINE.md with a fresh generated block, plus the FEATURES.md index. */
const docs = (root: string, manifests: Features) => {
  const out = new Map<string, string>();
  for (const manifest of manifests.values()) {
    const section = timelineSection(root, manifests, manifest, scanFeature(root, manifest.dir));
    const path = timelinePath(manifest);
    out.set(path, timelineText(read(join(root, path)), section));
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

/** The owner of the shared helpers in src/features/core/lib. Never a feature name: those have no "/". */
export const SHARED_LIB = "core/lib";

/**
 * Who owns a path under src: a feature's name, "app" for the kernel and the files at the top of
 * src, "gen" for generated files, "core/lib" for the shared helpers, or undefined for a file that
 * has no place.
 */
export const ownerOf = (path: string): string | undefined => {
  if (path.startsWith(`${SHARED_LIB_DIR}/`)) return SHARED_LIB;
  const core = new RegExp(`^${CORE_DIR}/([^/]+)/`).exec(path);
  if (core?.[1]) return core[1];
  if (path.startsWith(`${CORE_DIR}/`)) return undefined;
  const feature = new RegExp(`^${FEATURES_DIR}/([^/]+)/`).exec(path);
  if (feature?.[1]) return feature[1];
  if (path.startsWith("src/gen/") || path === "src/routeTree.gen.ts") return "gen";
  if (path.startsWith(`${APP_DIR}/`) || APP_FILES.includes(path)) return "app";
  return undefined;
};

/** The feature folder a path sits in, e.g. `src/features/core/kv`. */
const folderOf = (path: string, owner: string) =>
  path.startsWith(`${CORE_DIR}/${owner}/`) ? `${CORE_DIR}/${owner}` : `${FEATURES_DIR}/${owner}`;

const resolveImport = (root: string, file: string, spec: string): string | undefined => {
  if (spec.startsWith("#/")) return posix.normalize(`src/${spec.slice(2)}`);
  if (spec.startsWith("."))
    return toSlash(relative(root, normalize(join(dirname(join(root, file)), spec))));
  return undefined;
};

export interface Problem {
  readonly file: string;
  readonly message: string;
}

const KERNEL_RULE =
  "src/app and the files at the top of src may import only the app, src/gen and required features";
const LIB_RULE = `${SHARED_LIB_DIR} may import only src/app`;
const CORE_RULE =
  'a core module may import only the app, src/gen, core/lib and other core modules (an optional one only if it is in "requires")';

/** Why a core module may not import `target`, or undefined when it may. */
const coreCrossing = (manifests: Features, owner: string, target: string) => {
  const to = manifests.get(target);
  if (to && !isCoreModule(to)) {
    return `core module "${owner}" imports feature "${target}", which is outside core; nothing in ${CORE_DIR} imports a feature outside it`;
  }
  if (to?.required || withRequirements(manifests, [owner]).includes(target)) return undefined;
  return `core module "${owner}" imports optional module "${target}" without listing it in "requires"; ${CORE_RULE}`;
};

/** Why `owner` may not import `target`, or undefined when it may. */
const crossing = (manifests: Features, owner: string, target: string): string | undefined => {
  if (target === "app" || target === owner) return undefined;
  if (owner === SHARED_LIB) return `${SHARED_LIB_DIR} imports ${target}; ${LIB_RULE}`;
  if (target === "gen") return undefined;
  if (owner === "app") {
    if (target === SHARED_LIB) return `the app imports ${SHARED_LIB_DIR}; ${KERNEL_RULE}`;
    return manifests.get(target)?.required
      ? undefined
      : `the app imports feature "${target}"; ${KERNEL_RULE}`;
  }
  if (target === SHARED_LIB) return undefined;
  const from = manifests.get(owner);
  if (from && isCoreModule(from)) return coreCrossing(manifests, owner, target);
  if (manifests.get(target)?.required) return undefined;
  if (withRequirements(manifests, [owner]).includes(target)) return undefined;
  return `feature "${owner}" imports feature "${target}" without listing it in "requires"`;
};

const importProblems = (root: string, manifests: Features, file: string, owner: string) => {
  const problems: Array<Problem> = [];
  const text = readFileSync(join(root, file), "utf8");
  for (const spec of importSpecifiers(text)) {
    const target = resolveImport(root, file, spec);
    const targetOwner = target ? ownerOf(target) : undefined;
    const message = targetOwner ? crossing(manifests, owner, targetOwner) : undefined;
    if (message) problems.push({ file, message: `${message} (${spec})` });
  }
  return problems;
};

/** Why a file has no proper owner, or undefined when it has one. */
const placeProblem = (manifests: Features, file: string, owner: string | undefined) => {
  if (owner === undefined) {
    return file.startsWith(`${CORE_DIR}/`)
      ? `has no owner; put it in a module under ${CORE_DIR} or in ${SHARED_LIB_DIR}`
      : `has no owner; move it into ${APP_DIR} or a feature under ${FEATURES_DIR}`;
  }
  if (owner === "app" || owner === SHARED_LIB) return undefined;
  const folder = folderOf(file, owner);
  const manifest = manifests.get(owner);
  if (manifest?.dir === folder) return undefined;
  const elsewhere = manifest ? `; "${owner}" lives in ${manifest.dir}` : "";
  return `belongs to feature "${owner}", which has no ${folder}/${MANIFEST_FILE}${elsewhere}`;
};

/** Files with no owner, and imports that cross a feature boundary the manifests don't allow. */
export const boundaryProblems = (root: string): ReadonlyArray<Problem> => {
  const manifests = loadManifests(root);
  const problems: Array<Problem> = [];
  for (const file of walk(join(root, "src")).map((f) => toSlash(relative(root, f)))) {
    const owner = ownerOf(file);
    if (owner === "gen") continue;
    const message = placeProblem(manifests, file, owner);
    if (message) {
      problems.push({ file, message });
      continue;
    }
    if (owner && SOURCE.test(file)) problems.push(...importProblems(root, manifests, file, owner));
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
