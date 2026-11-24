import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

export const LOCK_FILE = "harness.lock.json";
const TARGET = ".claude";
const META = ".source.json";

export interface HarnessLock {
  readonly source: string;
  readonly commit: string;
  readonly files: Readonly<Record<string, string>>;
}

const walk = (dir: string): ReadonlyArray<string> =>
  existsSync(dir)
    ? readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
      )
    : [];

const hash = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");

const sourceMeta = (harness: string) =>
  existsSync(join(harness, META))
    ? (JSON.parse(readFileSync(join(harness, META), "utf8")) as { repo: string; commit: string })
    : { repo: "claude", commit: "unknown" };

const harnessFiles = (harness: string) =>
  walk(harness)
    .map((f) => relative(harness, f))
    .filter((f) => f !== META);

/** Copies the harness into `.claude/` and records what was copied, so later edits can be told apart. */
export const installHarness = (harness: string, project: string): HarnessLock => {
  const files: Record<string, string> = {};
  for (const file of harnessFiles(harness)) {
    const to = join(project, TARGET, file);
    mkdirSync(dirname(to), { recursive: true });
    cpSync(join(harness, file), to);
    files[file] = hash(to);
  }
  const meta = sourceMeta(harness);
  const lock: HarnessLock = { source: meta.repo, commit: meta.commit, files };
  writeFileSync(join(project, LOCK_FILE), `${JSON.stringify(lock, null, 2)}\n`);
  return lock;
};

export interface HarnessStatus {
  readonly changed: ReadonlyArray<string>;
  readonly missing: ReadonlyArray<string>;
}

/** Files in `.claude/` that no longer match the lock: edited locally, or deleted. */
export const harnessStatus = (project: string): HarnessStatus => {
  const lock = JSON.parse(readFileSync(join(project, LOCK_FILE), "utf8")) as HarnessLock;
  const changed: Array<string> = [];
  const missing: Array<string> = [];
  for (const [file, expected] of Object.entries(lock.files)) {
    const path = join(project, TARGET, file);
    if (!existsSync(path)) missing.push(file);
    else if (hash(path) !== expected) changed.push(file);
  }
  return { changed, missing };
};

/**
 * Brings `.claude/` up to the harness this CLI ships. Files edited locally are kept unless `force`;
 * the lock then records the new source commit.
 */
export const syncHarness = (harness: string, project: string, force = false) => {
  const kept = force ? [] : harnessStatus(project).changed;
  const updated: Array<string> = [];
  const files: Record<string, string> = {};
  const previous = JSON.parse(readFileSync(join(project, LOCK_FILE), "utf8")) as HarnessLock;
  for (const file of harnessFiles(harness)) {
    const to = join(project, TARGET, file);
    if (kept.includes(file)) {
      files[file] = previous.files[file] ?? hash(to);
      continue;
    }
    mkdirSync(dirname(to), { recursive: true });
    const before = existsSync(to) ? hash(to) : undefined;
    cpSync(join(harness, file), to);
    files[file] = hash(to);
    if (before !== files[file]) updated.push(file);
  }
  const meta = sourceMeta(harness);
  writeFileSync(
    join(project, LOCK_FILE),
    `${JSON.stringify({ source: meta.repo, commit: meta.commit, files }, null, 2)}\n`,
  );
  return { updated, kept };
};
