import { basename } from "node:path";
import type { FeatureLayout } from "../config.ts";
import { globToRegExp } from "../glob.ts";
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

const isTopLevelFile = (layout: FeatureLayout, name: string) => {
  if (layout.files.includes(name)) return true;
  const tested = /^(.+)\.test\.ts$/.exec(name)?.[1];
  return tested !== undefined && layout.files.includes(`${tested}.ts`);
};

/** Why a path inside a feature breaks the layout, or undefined when it fits. */
const misplaced = (layout: FeatureLayout, inner: ReadonlyArray<string>): string | undefined => {
  const [first = "", ...rest] = inner;
  const folder = rest.length ? first : undefined;
  if (folder !== undefined && !layout.folders.includes(folder)) {
    return `"${folder}/" is not a feature folder. ${allowed(layout)}`;
  }
  if (folder === undefined && !isTopLevelFile(layout, first)) {
    return `"${first}" may not sit at the top of a feature. ${allowed(layout)}`;
  }
  const name = basename(inner.join("/"));
  for (const [pattern, folders] of Object.entries(layout.placement)) {
    if (globToRegExp(pattern).test(name) && (folder === undefined || !folders.includes(folder))) {
      return `${pattern} files go only in ${folders.map((f) => `${f}/`).join(" or ")}.`;
    }
  }
  return undefined;
};

type Found = { readonly file: string; readonly line: number; readonly message: string };

/** Each feature's own files, as paths inside it; files loose in the features dir go under "". */
const byFeature = (prefix: string, allFiles: ReadonlySet<string>) => {
  const out = new Map<string, Array<string>>();
  for (const file of allFiles) {
    if (!file.startsWith(prefix)) continue;
    const rest = file.slice(prefix.length);
    const cut = rest.indexOf("/");
    const feature = cut < 0 ? "" : rest.slice(0, cut);
    out.set(feature, [...(out.get(feature) ?? []), cut < 0 ? rest : rest.slice(cut + 1)]);
  }
  return out;
};

const missing = (layout: FeatureLayout, folder: string, has: ReadonlyArray<string>) =>
  layout.required
    .filter((required) => !has.includes(required))
    .map((required): Found => {
      const fix = required === "TIMELINE.md" ? " `cf-saas-blocks sync` writes a fresh one." : "";
      const message = `missing; every feature has ${layout.required.join(" and ")}.${fix}`;
      return { file: `${folder}/${required}`, line: 1, message };
    });

export const featureLayout: ProjectRule = {
  id: "feature-layout",
  description: "Every path inside a feature uses the fixed vocabulary of folders and files.",
  checkProject: ({ config, allFiles }) => {
    const layout = config.featureLayout;
    const prefix = `${layout.dir}/`;
    return [...byFeature(prefix, allFiles)].flatMap(([feature, files]): ReadonlyArray<Found> => {
      if (!feature) {
        const message = "features are folders; move this into one.";
        return files.map((f) => ({ file: `${prefix}${f}`, line: 1, message }));
      }
      const folder = `${prefix}${feature}`;
      const stray = files.flatMap((f) => {
        const message = misplaced(layout, f.split("/"));
        return message ? [{ file: `${folder}/${f}`, line: 1, message }] : [];
      });
      return [...stray, ...missing(layout, folder, files)];
    });
  },
};
