import { basename } from "node:path";
import type { FeatureLayout } from "../config.ts";
import { globToRegExp } from "../glob.ts";
import { type Place, placeOf } from "../place.ts";
import type { ProjectRule } from "./types.ts";

/** What each default folder is for, so a message can say where a file belongs. */
const PURPOSE: Readonly<Record<string, string>> = {
  api: "server functions and services",
  routes: "file routes",
  components: "React, with UI machines beside them",
  machines: "lifecycle machines",
  lib: "pure helpers",
  e2e: "Playwright specs",
};

const folderList = (layout: FeatureLayout) =>
  layout.folders.map((f) => (PURPOSE[f] ? `${f}/ (${PURPOSE[f]})` : `${f}/`)).join(", ");

const allowed = (layout: FeatureLayout) =>
  `A feature holds only the folders ${folderList(layout)} and the top-level files ${layout.files.join(", ")}, each with an optional sibling *.test.ts.`;

/** The rule for the core group, stated in every core finding. */
export const coreRule = (layout: FeatureLayout) =>
  `Core holds shared modules of one kind: components only (${layout.core.componentFolders.map((f) => `${f}/`).join(", ")}), or services and helpers only (no components/, server routes only under routes/${layout.core.serverRoutes}/). A module with both, or with a page, is a feature; move it out of core to ${layout.dir}/<name>.`;

const isListedFile = (files: ReadonlyArray<string>, name: string) => {
  if (files.includes(name)) return true;
  const tested = /^(.+)\.test\.ts$/.exec(name)?.[1];
  return tested !== undefined && files.includes(`${tested}.ts`);
};

const placementProblem = (layout: FeatureLayout, folder: string | undefined, name: string) => {
  for (const [pattern, folders] of Object.entries(layout.placement)) {
    if (globToRegExp(pattern).test(name) && (folder === undefined || !folders.includes(folder))) {
      return `${pattern} files go only in ${folders.map((f) => `${f}/`).join(" or ")}.`;
    }
  }
  return undefined;
};

/** Why a path inside a feature breaks the layout, or undefined when it fits. */
const misplaced = (layout: FeatureLayout, inner: ReadonlyArray<string>): string | undefined => {
  const [first = "", ...rest] = inner;
  const folder = rest.length ? first : undefined;
  if (folder !== undefined && !layout.folders.includes(folder)) {
    return `"${folder}/" is not a feature folder. ${allowed(layout)}`;
  }
  if (folder === undefined && !isListedFile(layout.files, first)) {
    return `"${first}" may not sit at the top of a feature. ${allowed(layout)}`;
  }
  return placementProblem(layout, folder, basename(inner.join("/")));
};

/** Why a path in a components module (shared React only) breaks the core rule. */
const componentsProblem = (layout: FeatureLayout, inner: ReadonlyArray<string>) => {
  const { componentFolders, componentFiles } = layout.core;
  const [first = "", ...rest] = inner;
  const folder = rest.length ? first : undefined;
  const name = basename(inner.join("/"));
  if (folder !== undefined && !componentFolders.includes(folder)) {
    return `"${folder}/" next to components/ mixes kinds. ${coreRule(layout)}`;
  }
  if (folder === undefined && !isListedFile(componentFiles, first)) {
    return `"${first}" next to components/ mixes kinds; a components module has only ${componentFiles.join(", ")} at its top. ${coreRule(layout)}`;
  }
  if (name.endsWith(".machine.ts")) {
    return `a machine beside shared components gives them logic of their own. ${coreRule(layout)}`;
  }
  return undefined;
};

/** Why a path in a services module (no React, no pages) breaks the core rule. */
const servicesProblem = (layout: FeatureLayout, inner: ReadonlyArray<string>) => {
  const { serviceFolders, serverRoutes } = layout.core;
  const [first = "", second, ...rest] = inner;
  const folder = second === undefined ? undefined : first;
  if (folder !== undefined && !serviceFolders.includes(folder)) {
    return `"${folder}/" has no place in a core module. ${coreRule(layout)}`;
  }
  if (folder === "routes" && !(second === serverRoutes && rest.length)) {
    return `"routes/${[second, ...rest].join("/")}" is a page; a core module serves only server routes under routes/${serverRoutes}/. ${coreRule(layout)}`;
  }
  if (inner.join("/").endsWith(".tsx")) {
    return `"${inner.join("/")}" is React in a services module. ${coreRule(layout)}`;
  }
  return misplaced(layout, inner);
};

const coreProblem = (layout: FeatureLayout, files: ReadonlyArray<string>, inner: string) => {
  const isComponents = files.some((f) => f.startsWith("components/"));
  const parts = inner.split("/");
  return isComponents ? componentsProblem(layout, parts) : servicesProblem(layout, parts);
};

const libProblem = (layout: FeatureLayout, inner: string) => {
  if (!inner.includes("/") && /\.ts$/.test(inner) && !inner.endsWith(".d.ts")) return undefined;
  return `${layout.dir}/${layout.core.dir}/${layout.core.lib}/ holds flat .ts helpers, each with a sibling test: no folders, no React, no feature.json.`;
};

type Found = { readonly file: string; readonly line: number; readonly message: string };

/** Each folder's files, as paths inside it, keyed by its folder under the features dir. */
const byFolder = (layout: FeatureLayout, allFiles: ReadonlySet<string>) => {
  const out = new Map<string, { kind: Place["kind"]; files: Array<string> }>();
  for (const file of allFiles) {
    const place = placeOf(layout, file);
    if (!place) continue;
    const key = place.kind === "loose" ? `loose:${place.folder}` : place.folder;
    const entry = out.get(key) ?? { kind: place.kind, files: [] };
    entry.files.push(place.inner);
    out.set(key, entry);
  }
  return out;
};

const missing = (layout: FeatureLayout, folder: string, has: ReadonlyArray<string>) =>
  layout.required
    .filter((required) => !has.includes(required))
    .map((required): Found => {
      const fix =
        required === "TIMELINE.md" ? " `software-factory-blocks sync` writes a fresh one." : "";
      const message = `missing; every feature has ${layout.required.join(" and ")}.${fix}`;
      return { file: `${folder}/${required}`, line: 1, message };
    });

const folderFindings = (
  layout: FeatureLayout,
  key: string,
  kind: Place["kind"],
  files: ReadonlyArray<string>,
): ReadonlyArray<Found> => {
  if (kind === "loose") {
    const where = key.slice("loose:".length);
    const at = where ? `${layout.dir}/${where}` : layout.dir;
    const message = where
      ? "core modules are folders; move this into one."
      : "features are folders; move this into one.";
    return files.map((f) => ({ file: `${at}/${f}`, line: 1, message }));
  }
  const folder = `${layout.dir}/${key}`;
  const check = (inner: string) => {
    if (kind === "lib") return libProblem(layout, inner);
    if (kind === "core") return coreProblem(layout, files, inner);
    return misplaced(layout, inner.split("/"));
  };
  const stray = files.flatMap((f) => {
    const message = check(f);
    return message ? [{ file: `${folder}/${f}`, line: 1, message }] : [];
  });
  return kind === "lib" ? stray : [...stray, ...missing(layout, folder, files)];
};

export const featureLayout: ProjectRule = {
  id: "feature-layout",
  description:
    "Every path inside a feature uses the fixed vocabulary; each core module is of one kind: components only, or services and helpers only.",
  checkProject: ({ config, allFiles }) => {
    const layout = config.featureLayout;
    return [...byFolder(layout, allFiles)].flatMap(([key, { kind, files }]) =>
      folderFindings(layout, key, kind, files),
    );
  },
};
