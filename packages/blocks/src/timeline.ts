import { existsSync } from "node:fs";
import { join } from "node:path";
import { contributions, GEN_DIR, ROUTES_DIR } from "./generate.ts";
import type { Manifests } from "./graph.ts";
import { type BlockManifest, FEATURES_DIR } from "./manifest.ts";
import type { FeatureScan } from "./scan.ts";

/** Each feature's notes: a generated block `sync` owns, and Decisions and History people write. */
export const TIMELINE_FILE = "TIMELINE.md";
/** Same markers as `@tanstack-cf-saas/lint`, which reads them for the timeline gate. */
export const GENERATED_START = "<!-- generated:start -->";
export const GENERATED_END = "<!-- generated:end -->";

export const timelinePath = (name: string) => `${FEATURES_DIR}/${name}/${TIMELINE_FILE}`;

/** The hand-written part of a new TIMELINE.md. */
export const TIMELINE_SKELETON = `## Decisions

<!-- Newest first, one line each: - YYYY-MM-DD — <decision>. Why: <reason>. (<commit sha or PR URL>) -->

## History

<!-- Newest first, one line each: - YYYY-MM-DD — <what changed>. (<commit sha or PR URL>) -->
`;

const code = (items: ReadonlyArray<string>) =>
  items.length ? items.map((i) => `\`${i}\``).join(", ") : "none";

const links = (names: ReadonlyArray<string>) =>
  names.length ? names.map((n) => `[${n}](../${n}/${TIMELINE_FILE})`).join(", ") : "none";

/** `NAME (note)` pairs, the name in code. */
const noted = (items: ReadonlyArray<readonly [string, string | undefined]>) =>
  items.length
    ? items.map(([name, note]) => (note ? `\`${name}\` (${note})` : `\`${name}\``)).join(", ")
    : "none";

const settings = (specs: BlockManifest["vars"]) =>
  noted(
    Object.entries(specs ?? {})
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, spec]) => [key, spec.required ? "required" : undefined] as const),
  );

const GEN_FILE: Readonly<Record<string, string>> = { layer: "layers", viewer: "viewer" };

/** The src/gen files a feature feeds, from the contribution files and routes folder it has. */
const feeds = (root: string, name: string) => {
  const dir = join(root, FEATURES_DIR, name);
  const fed = contributions
    .filter((c) => existsSync(join(dir, `${c}.ts`)))
    .map((c) => `${GEN_DIR}/${GEN_FILE[c] ?? c}.ts`);
  return existsSync(join(dir, ROUTES_DIR)) ? [...fed, `${GEN_DIR}/routes.ts`] : fed;
};

/** Features that list `name` in their `requires`. */
const usedBy = (manifests: Manifests, name: string) =>
  [...manifests.values()]
    .filter((m) => m.requires.includes(name))
    .map((m) => m.name)
    .sort();

/** The generated block of a feature's TIMELINE.md, markers included. */
export const timelineSection = (
  root: string,
  manifests: Manifests,
  manifest: BlockManifest,
  scan: FeatureScan,
): string => {
  const kind = manifest.core
    ? "core; it can't be removed"
    : `optional; \`cf-saas-blocks remove ${manifest.name}\` takes it out`;
  const machines = scan.machines.length
    ? `${code(scan.machines)}. Diagrams under Machines, from \`bun run machines:print\`.`
    : "none";
  const lines = [
    `- Kind: ${kind}`,
    `- Depends on: ${links([...manifest.requires].sort())}`,
    `- Used by: ${links(usedBy(manifests, manifest.name))}`,
    `- Bindings: ${noted((manifest.bindings ?? []).map((b) => [b.binding, b.type] as const))}`,
    `- Vars: ${settings(manifest.vars)}`,
    `- Secrets: ${settings(manifest.secrets)}`,
    `- Also owns: ${code([...(manifest.files ?? [])].sort())}`,
    `- Feeds: ${code(feeds(root, manifest.name))}`,
    `- Routes: ${code(scan.routes)}`,
    `- Services: ${code(scan.services)}`,
    `- Errors: ${code(scan.errors)}`,
    `- Events: ${code(scan.events)}`,
    `- Machines: ${machines}`,
  ];
  return [
    GENERATED_START,
    "<!-- Written by `cf-saas-blocks sync` from feature.json and the source. Edits here are lost. -->",
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
