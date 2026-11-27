import { defaultFeatureLayout } from "./config.ts";
import { byCodeUnit } from "./files.ts";
import { placeOf } from "./place.ts";
import { handWritten, TIMELINE_FILE } from "./timeline-doc.ts";

/** A Decisions or History line: `- YYYY-MM-DD — ...`. */
const ENTRY = /^- \d{4}-\d{2}-\d{2}\b/;

const entries = (text: string | undefined): ReadonlyArray<string> =>
  handWritten(text ?? "")
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => ENTRY.test(line));

/** Dated lines in the hand-written part of `after` that `before` did not have. */
export const newEntries = (
  before: string | undefined,
  after: string | undefined,
): ReadonlyArray<string> => {
  const old = new Set(entries(before));
  return entries(after).filter((line) => !old.has(line));
};

/**
 * Changed files grouped by feature folder (`auth`, or `core/kv` for a core module), leaving out
 * each feature's own TIMELINE.md. The shared helpers in core/lib have no timeline.
 */
export const touchedFeatures = (
  featuresDir: string,
  changed: ReadonlyArray<string>,
  coreDir = defaultFeatureLayout.core.dir,
): ReadonlyMap<string, ReadonlyArray<string>> => {
  const out = new Map<string, Array<string>>();
  const layout = {
    ...defaultFeatureLayout,
    dir: featuresDir,
    core: { ...defaultFeatureLayout.core, dir: coreDir },
  };
  for (const path of [...new Set(changed)].sort(byCodeUnit)) {
    const place = placeOf(layout, path);
    if (!place || place.kind === "loose" || place.kind === "lib") continue;
    if (place.inner === TIMELINE_FILE) continue;
    out.set(place.folder, [...(out.get(place.folder) ?? []), place.inner]);
  }
  return out;
};

export interface TimelineText {
  /** TIMELINE.md at the base, if it existed. */
  readonly before: string | undefined;
  /** TIMELINE.md now, if it exists. A missing one means the feature was removed. */
  readonly after: string | undefined;
}

export interface TimelineProblem {
  readonly feature: string;
  readonly message: string;
}

/** Features that changed without a new dated line in the hand-written part of their timeline. */
export const timelineProblems = (
  featuresDir: string,
  changed: ReadonlyArray<string>,
  timelines: ReadonlyMap<string, TimelineText>,
  coreDir = defaultFeatureLayout.core.dir,
): ReadonlyArray<TimelineProblem> =>
  [...touchedFeatures(featuresDir, changed, coreDir)].flatMap(([feature, files]) => {
    const timeline = timelines.get(feature);
    if (timeline?.after === undefined) return [];
    if (newEntries(timeline.before, timeline.after).length) return [];
    const path = `${featuresDir}/${feature}/${TIMELINE_FILE}`;
    const shown = files.length > 3 ? [...files.slice(0, 3), "..."] : files;
    return [
      {
        feature,
        message: `${feature} changed (${shown.join(", ")}) with no new line in ${path}. Add "- YYYY-MM-DD — what and why" under ## Decisions or ## History.`,
      },
    ];
  });
