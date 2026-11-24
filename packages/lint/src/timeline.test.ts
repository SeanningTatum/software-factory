import { describe, expect, test } from "bun:test";
import { newEntries, timelineProblems, touchedFeatures } from "./timeline.ts";

const doc = (generated: string, hand: string) =>
  `<!-- generated:start -->\n${generated}\n<!-- generated:end -->\n\n## Decisions\n${hand}\n\n## History\n`;

describe("newEntries", () => {
  test("finds dated lines added by hand", () => {
    const before = doc("# KV", "- 2026-11-24 — Old. Why: x.");
    const after = doc("# KV", "- 2026-11-25 — New. Why: y.\n- 2026-11-24 — Old. Why: x.");
    expect(newEntries(before, after)).toEqual(["- 2026-11-25 — New. Why: y."]);
  });

  test("ignores the generated and machines blocks and undated lines", () => {
    const before = doc("# KV", "");
    const after = `${doc("# KV\n- 2026-11-25 — in the generated part", "- not dated")}\n<!-- machines:start -->\n- 2026-11-25 — x\n<!-- machines:end -->\n`;
    expect(newEntries(before, after)).toEqual([]);
  });

  test("counts every line of a new timeline", () => {
    expect(newEntries(undefined, doc("# KV", "- 2026-11-24 — First."))).toEqual([
      "- 2026-11-24 — First.",
    ]);
  });
});

describe("touchedFeatures", () => {
  test("groups changes by feature and leaves out TIMELINE.md", () => {
    const changed = [
      "src/features/kv/api/key-value.ts",
      "src/features/kv/TIMELINE.md",
      "src/features/db/TIMELINE.md",
      "src/app/env.ts",
      "src/features/kv/layer.ts",
      "src/features/README.md",
    ];
    expect([...touchedFeatures("src/features", changed)]).toEqual([
      ["kv", ["api/key-value.ts", "layer.ts"]],
    ]);
  });

  test("keys a core module by its folder and leaves out core/lib", () => {
    const changed = [
      "src/features/core/kv/api/key-value.ts",
      "src/features/core/kv/TIMELINE.md",
      "src/features/core/lib/call.ts",
      "src/features/core/README.md",
      "src/features/auth/api/auth.ts",
    ];
    expect([...touchedFeatures("src/features", changed)]).toEqual([
      ["auth", ["api/auth.ts"]],
      ["core/kv", ["api/key-value.ts"]],
    ]);
  });
});

describe("timelineProblems", () => {
  const changed = ["src/features/kv/api/key-value.ts", "src/features/db/api/database.ts"];

  test("passes when each changed feature has a new line", () => {
    const timelines = new Map([
      ["kv", { before: doc("", ""), after: doc("", "- 2026-11-25 — Cache misses. Why: x.") }],
      ["db", { before: undefined, after: doc("", "- 2026-11-25 — First.") }],
    ]);
    expect(timelineProblems("src/features", changed, timelines)).toEqual([]);
  });

  test("fails a feature whose timeline only changed in the generated part", () => {
    const timelines = new Map([
      ["kv", { before: doc("# KV", ""), after: doc("# KV v2", "") }],
      ["db", { before: doc("", ""), after: doc("", "- 2026-11-25 — x") }],
    ]);
    expect(timelineProblems("src/features", changed, timelines)).toEqual([
      {
        feature: "kv",
        message:
          'kv changed (api/key-value.ts) with no new line in src/features/kv/TIMELINE.md. Add "- YYYY-MM-DD — what and why" under ## Decisions or ## History.',
      },
    ]);
  });

  test("skips a removed feature and a change only to TIMELINE.md", () => {
    const timelines = new Map([["kv", { before: doc("", ""), after: undefined }]]);
    const onlyTimeline = ["src/features/db/TIMELINE.md", ...changed.slice(0, 1)];
    expect(timelineProblems("src/features", onlyTimeline, timelines)).toEqual([]);
  });
});
