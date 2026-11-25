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

/**
 * A file's hash with CRLF read as LF, so a Windows checkout (core.autocrlf) doesn't count as an
 * edit. LF files hash as before, so older locks still match.
 */
const hash = (path: string) =>
  createHash("sha256").update(readFileSync(path, "utf8").replaceAll("\r\n", "\n")).digest("hex");

const readLock = (project: string): HarnessLock => {
  const path = join(project, LOCK_FILE);
  if (!existsSync(path))
    throw new Error(
      `No ${LOCK_FILE} in ${project}. Run this in a project created with the Claude workflows (without --no-claude).`,
    );
  return JSON.parse(readFileSync(path, "utf8")) as HarnessLock;
};

const sourceMeta = (harness: string) =>
  existsSync(join(harness, META))
    ? (JSON.parse(readFileSync(join(harness, META), "utf8")) as { repo: string; commit: string })
    : { repo: "claude", commit: "unknown" };

const harnessFiles = (harness: string) =>
  walk(harness)
    .map((f) => relative(harness, f).replaceAll("\\", "/"))
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
  const lock = readLock(project);
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
 * Brings `.claude/` up to the harness this CLI ships. Files edited locally are kept unless `force`,
 * and so are files of your own at a path the lock doesn't list; the lock then records the new
 * source commit.
 */
export const syncHarness = (harness: string, project: string, force = false) => {
  const previous = readLock(project);
  const edited = force ? [] : harnessStatus(project).changed;
  const updated: Array<string> = [];
  const kept: Array<string> = [];
  const files: Record<string, string> = {};
  for (const file of harnessFiles(harness)) {
    const from = join(harness, file);
    const to = join(project, TARGET, file);
    const before = existsSync(to) ? hash(to) : undefined;
    const theirs = before !== undefined && !(file in previous.files) && before !== hash(from);
    if (edited.includes(file) || (theirs && !force)) {
      // Lock the shipped hash, so `check` keeps showing the file as changed.
      files[file] = previous.files[file] ?? hash(from);
      kept.push(file);
      continue;
    }
    mkdirSync(dirname(to), { recursive: true });
    cpSync(from, to);
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
