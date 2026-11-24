import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "./config.ts";
import { type TimelineText, timelineProblems, touchedFeatures } from "./timeline.ts";
import { TIMELINE_FILE } from "./timeline-doc.ts";

export interface TimelineOptions {
  /** The ref to compare with. Default: origin/main, else HEAD~1. */
  readonly base?: string;
  /** Skip the gate, for a change too small to record. */
  readonly skip?: boolean;
}

export interface TimelineResult {
  readonly code: 0 | 1;
  readonly lines: ReadonlyArray<string>;
}

const git = (root: string, args: ReadonlyArray<string>): string | undefined => {
  const out = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  return out.status === 0 ? out.stdout : undefined;
};

const verified = (root: string, ref: string) =>
  git(root, ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]) !== undefined;

/** NUL-separated `-z` output: paths exactly as stored, never quoted. */
const paths = (text: string | undefined) => (text ?? "").split("\0").filter(Boolean);

const skipped = (why: string): TimelineResult => ({
  code: 0,
  lines: [`timeline: ${why}; skipped.`],
});

/**
 * The timeline gate: every feature a change touches gets a new dated line in its TIMELINE.md.
 * Compares the working tree (tracked and untracked files) with where it left `base`.
 */
export const runTimeline = (root: string, options: TimelineOptions = {}): TimelineResult => {
  if (options.skip) return skipped("asked to skip (--skip or TIMELINE_SKIP=1)");
  if (git(root, ["rev-parse", "--is-inside-work-tree"]) === undefined) {
    return skipped("not a git repository");
  }
  const candidates = options.base ? [options.base] : ["origin/main", "HEAD~1"];
  const base = candidates.find((ref) => verified(root, ref));
  if (!base) return skipped(`no base ref (${candidates.join(", ")})`);
  const from = git(root, ["merge-base", base, "HEAD"])?.trim() || base;
  const changed = [
    // --no-renames: a file moved between features changes both of them.
    ...paths(git(root, ["diff", "--name-only", "-z", "--no-renames", "--relative", from])),
    ...paths(git(root, ["ls-files", "-z", "--others", "--exclude-standard"])),
  ];
  const { dir, core } = loadConfig(root).featureLayout;
  const timelines = new Map<string, TimelineText>();
  for (const feature of touchedFeatures(dir, changed, core.dir).keys()) {
    const path = `${dir}/${feature}/${TIMELINE_FILE}`;
    const full = join(root, path);
    timelines.set(feature, {
      before: git(root, ["show", `${from}:./${path}`]),
      after: existsSync(full) ? readFileSync(full, "utf8") : undefined,
    });
  }
  const problems = timelineProblems(dir, changed, timelines, core.dir);
  if (!problems.length) {
    return { code: 0, lines: [`timeline: every changed feature has a new line (base ${base}).`] };
  }
  return {
    code: 1,
    lines: [
      ...problems.map((p) => p.message),
      `\n${problems.length} feature(s) changed without a timeline line. For a trivial change, set TIMELINE_SKIP=1 or add the no-timeline label to the pull request.`,
    ],
  };
};
