import { describe, expect, test } from "bun:test";
import {
  GENERATED_END,
  handWritten,
  MACHINES_END,
  MACHINES_START,
  withBlock,
} from "./timeline-doc.ts";

const base = `<!-- generated:start -->\n# KV\n${GENERATED_END}\n\n## Decisions\n`;
const block = `${MACHINES_START}\nA\n${MACHINES_END}`;
const put = (text: string, b: string) =>
  withBlock(text, MACHINES_START, MACHINES_END, b, GENERATED_END);

describe("withBlock", () => {
  test("adds a block after the anchor, replaces it, and removes it again", () => {
    const added = put(base, block);
    expect(added).toBe(
      `<!-- generated:start -->\n# KV\n${GENERATED_END}\n\n${block}\n\n## Decisions\n`,
    );
    expect(put(added, block)).toBe(added);
    const replaced = put(added, `${MACHINES_START}\nB\n${MACHINES_END}`);
    expect(replaced).toContain("\nB\n");
    expect(put(replaced, "")).toBe(base);
  });

  test("appends when the anchor is missing", () => {
    expect(put("## Decisions\n", block)).toBe(`## Decisions\n\n${block}\n`);
  });
});

describe("handWritten", () => {
  test("cuts out both marked blocks", () => {
    expect(handWritten(put(base, block))).toBe("\n\n\n\n## Decisions\n");
  });
});
