import { existsSync } from "node:fs";
import { join, posix } from "node:path";
// The timeline gate in lint reads the same markers, so they are defined there once.
import { byCodeUnit, GENERATED_END, GENERATED_START, TIMELINE_FILE } from "@software-factory/lint";
import { contributions, GEN_DIR, ROUTES_DIR } from "./generate.ts";
import { type BlockManifest, type Feature, type Features, isCoreModule } from "./manifest.ts";
import type { FeatureScan } from "./scan.ts";

/** Where a feature's TIMELINE.md is, from the project root. */
export const timelinePath = (feature: Pick<Feature, "dir">) => `${feature.dir}/${TIMELINE_FILE}`;

/** The hand-written part of a new TIMELINE.md. */
export const TIMELINE_SKELETON = `## Decisions

<!-- Newest first, one line each: - YYYY-MM-DD — <decision>. Why: <reason>. (<commit sha or PR URL>) -->

## History

<!-- Newest first, one line each: - YYYY-MM-DD — <what changed>. (<commit sha or PR URL>) -->
`;

const code = (items: ReadonlyArray<string>) =>
  items.length ? items.map((i) => `\`${i}\``).join(", ") : "none";

/** Links from `from`'s TIMELINE.md to each named feature's. */
const links = (features: Features, from: Feature, names: ReadonlyArray<string>) =>
  names.length
    ? names
        .map((n) => {
          const dir = features.get(n)?.dir;
          const to = dir ? posix.relative(from.dir, dir) : `../${n}`;
          return `[${n}](${to}/${TIMELINE_FILE})`;
        })
        .join(", ")
    : "none";

/** `NAME (note)` pairs, the name in code. */
const noted = (items: ReadonlyArray<readonly [string, string | undefined]>) =>
  items.length
    ? items.map(([name, note]) => (note ? `\`${name}\` (${note})` : `\`${name}\``)).join(", ")
    : "none";

const settings = (specs: BlockManifest["vars"]) =>
  noted(
    Object.entries(specs ?? {})
      .sort(([a], [b]) => byCodeUnit(a, b))
      .map(([key, spec]) => [key, spec.required ? "required" : undefined] as const),
  );

const GEN_FILE: Readonly<Record<string, string>> = { layer: "layers", viewer: "viewer" };

/** The src/gen files a feature feeds, from the contribution files and routes folder it has. */
const feeds = (root: string, feature: Feature) => {
  const dir = join(root, feature.dir);
  const fed = contributions
    .filter((c) => existsSync(join(dir, `${c}.ts`)))
    .map((c) => `${GEN_DIR}/${GEN_FILE[c] ?? c}.ts`);
  return existsSync(join(dir, ROUTES_DIR)) ? [...fed, `${GEN_DIR}/routes.ts`] : fed;
};

/** Features that list `name` in their `requires`. */
const usedBy = (manifests: Features, name: string) =>
  [...manifests.values()]
    .filter((m) => m.requires.includes(name))
    .map((m) => m.name)
    .sort(byCodeUnit);

/** The generated block of a feature's TIMELINE.md, markers included. */
export const timelineSection = (
  root: string,
  manifests: Features,
  manifest: Feature,
  scan: FeatureScan,
): string => {
  const where = isCoreModule(manifest) ? "core module" : "feature";
  const kind = manifest.required
    ? `${where}, required; it can't be removed`
    : manifest.auto
      ? `${where}, auto; on whenever ${manifest.requires.join(" and ")} are, and removed with either`
      : `${where}, optional; \`software-factory-blocks remove ${manifest.name}\` takes it out`;
  const machines = scan.machines.length
    ? `${code(scan.machines)}. Diagrams under Machines, from \`bun run machines:print\`.`
    : "none";
  const lines = [
    `- Kind: ${kind}`,
    `- Depends on: ${links(manifests, manifest, [...manifest.requires].sort(byCodeUnit))}`,
    `- Used by: ${links(manifests, manifest, usedBy(manifests, manifest.name))}`,
    `- Bindings: ${noted((manifest.bindings ?? []).map((b) => [b.binding, b.type] as const))}`,
    `- Vars: ${settings(manifest.vars)}`,
    `- Secrets: ${settings(manifest.secrets)}`,
    `- Also owns: ${code([...(manifest.files ?? [])].sort(byCodeUnit))}`,
    `- Feeds: ${code(feeds(root, manifest))}`,
    `- Routes: ${code(scan.routes)}`,
    `- Services: ${code(scan.services)}`,
    `- Errors: ${code(scan.errors)}`,
    `- Events: ${code(scan.events)}`,
    `- Machines: ${machines}`,
  ];
  return [
    GENERATED_START,
    "<!-- Written by `software-factory-blocks sync` from feature.json and the source. Edits here are lost. -->",
    "",
    `# ${manifest.title} (\`${manifest.name}\`)`,
    "",
    manifest.description,
    "",
    ...lines,
    GENERATED_END,
  ].join("\n");
};

/** TIMELINE.md with a fresh generated block, keeping everything people wrote. */
export const timelineText = (existing: string | undefined, section: string): string => {
  if (existing === undefined) return `${section}\n\n${TIMELINE_SKELETON}`;
  const from = existing.indexOf(GENERATED_START);
  const to = from < 0 ? -1 : existing.indexOf(GENERATED_END, from);
  if (to < 0) return `${section}\n\n${existing}`;
  return existing.slice(0, from) + section + existing.slice(to + GENERATED_END.length);
};
