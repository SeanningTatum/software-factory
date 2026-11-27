import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { removeBlock } from "./ops.ts";
import { check, sync } from "./sync.ts";
import { TIMELINE_SKELETON, timelineText } from "./timeline.ts";

const manifest = (name: string, extra: Record<string, unknown> = {}) =>
  JSON.stringify({
    name,
    title: name.toUpperCase(),
    description: `${name}.`,
    requires: [],
    ...extra,
  });

/** Required core module `ui`, optional core module `db`, and feature `auth` which requires `db`. */
const project = () => {
  const root = mkdtempSync(join(tmpdir(), "software-factory-timeline-"));
  const files: Record<string, string> = {
    "package.json": JSON.stringify({ name: "app" }),
    "software-factory.json": JSON.stringify({
      name: "app",
      template: "t",
      managed: { bindings: [], vars: [] },
    }),
    "wrangler.jsonc": '{ "name": "app" }\n',
    "src/features/core/ui/feature.json": manifest("ui", { required: true }),
    "src/features/core/db/feature.json": manifest("db", {
      files: ["drizzle"],
      bindings: [{ type: "d1", binding: "DB", database: "{project}-db{suffix}" }],
      secrets: {
        DB_TOKEN: { description: "t", required: true },
        A_KEY: { description: "a", required: false },
      },
    }),
    "src/features/core/db/layer.ts": "export const layer = 1;\n",
    "src/features/core/db/api/database.ts": "export class Database extends Context.Service<\n",
    "src/features/auth/feature.json": manifest("auth", { requires: ["db"] }),
    "src/features/auth/routes/login.tsx": "",
    "src/features/auth/components/credentials.machine.ts": "",
  };
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
};

const read = (root: string, path: string) => readFileSync(join(root, path), "utf8");

describe("TIMELINE.md", () => {
  test("sync writes one per feature with the skeleton, and a second sync changes nothing", () => {
    const root = project();
    sync(root);
    const db = read(root, "src/features/core/db/TIMELINE.md");
    expect(db).toContain(
      "# DB (`db`)\n\ndb.\n\n- Kind: core module, optional; `software-factory-blocks remove db` takes it out",
    );
    expect(db).toContain("- Used by: [auth](../../auth/TIMELINE.md)\n");
    expect(db).toContain("- Bindings: `DB` (d1)\n");
    expect(db).toContain("- Secrets: `A_KEY`, `DB_TOKEN` (required)\n");
    expect(db).toContain("- Also owns: `drizzle`\n- Feeds: `src/gen/layers.ts`\n");
    expect(db).toContain("- Services: `Database`\n");
    expect(db).toEndWith(`<!-- generated:end -->\n\n${TIMELINE_SKELETON}`);
    const auth = read(root, "src/features/auth/TIMELINE.md");
    expect(auth).toContain(
      "- Kind: feature, optional; `software-factory-blocks remove auth` takes it out",
    );
    expect(auth).toContain("- Depends on: [db](../core/db/TIMELINE.md)\n");
    expect(auth).toContain("- Routes: `/login`\n");
    expect(auth).toContain("- Machines: `components/credentials.machine.ts`. Diagrams under");
    expect(read(root, "src/features/core/ui/TIMELINE.md")).toContain(
      "- Kind: core module, required; it can't be removed",
    );
    expect(sync(root)).toEqual([]);
    expect(check(root)).toEqual([]);
  });

  test("keeps the hand-written part and check catches a hand edit to the generated block", () => {
    const root = project();
    sync(root);
    const path = "src/features/core/db/TIMELINE.md";
    const handWritten = read(root, path).replace(
      "## History\n",
      "## History\n\n- 2026-11-24 — Born.\n",
    );
    writeFileSync(join(root, path), handWritten.replace("db.\n", "a better db.\n"));
    expect(check(root)).toEqual([
      {
        file: path,
        message:
          "generated block out of date; run `bun run blocks:sync` (never edit between the generated markers)",
      },
    ]);
    sync(root);
    expect(read(root, path)).toBe(handWritten);
  });

  test("removing a feature refreshes the others' used-by lines and FEATURES.md", () => {
    const root = project();
    sync(root);
    expect(read(root, "FEATURES.md")).toContain(
      "- **auth** (optional): auth. Requires: db. [TIMELINE.md](src/features/auth/TIMELINE.md)",
    );
    removeBlock(root, "auth", { force: true });
    expect(read(root, "src/features/core/db/TIMELINE.md")).toContain("- Used by: none\n");
    expect(read(root, "FEATURES.md")).not.toContain("auth");
    expect(existsSync(join(root, "src/features/auth"))).toBe(false);
    expect(check(root)).toEqual([]);
  });
});

describe("timelineText", () => {
  test("puts the block above a file that has none", () => {
    expect(
      timelineText("## Decisions\n", "<!-- generated:start -->\nX\n<!-- generated:end -->"),
    ).toBe("<!-- generated:start -->\nX\n<!-- generated:end -->\n\n## Decisions\n");
  });
});

describe("FEATURES.md", () => {
  test("groups core modules and features, required first, and check fails when it is missing", () => {
    const root = project();
    sync(root);
    const lines = read(root, "FEATURES.md")
      .split("\n")
      .filter((l) => l.startsWith("- ") || l.startsWith("## "));
    expect(lines.map((l) => (l.startsWith("- ") ? l.slice(0, l.indexOf(":")) : l))).toEqual([
      "## Core modules",
      "- **ui** (required)",
      "- **db** (optional)",
      "## Features",
      "- **auth** (optional)",
    ]);
    expect(read(root, "FEATURES.md")).toContain("[TIMELINE.md](src/features/core/db/TIMELINE.md)");
    writeFileSync(join(root, "FEATURES.md"), "");
    expect(check(root).map((p) => p.file)).toEqual(["FEATURES.md"]);
  });
});
