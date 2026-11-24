import { describe, expect, test } from "bun:test";
import { freshHistory } from "./timeline.ts";

const LINE = "- 2030-01-02 — Created from create-tanstack-cf-saas 1.0.0.";

describe("freshHistory", () => {
  test("replaces the History lines and keeps its guide comment and the Decisions", () => {
    const text =
      "<!-- generated:start -->\nx\n<!-- generated:end -->\n\n## Decisions\n\n- 2026-01-01 — A. Why: B.\n\n## History\n\n<!-- guide -->\n\n- 2026-11-24 — Moved.\n- 2026-01-01 — Made.\n";
    expect(freshHistory(text, LINE)).toBe(
      `<!-- generated:start -->\nx\n<!-- generated:end -->\n\n## Decisions\n\n- 2026-01-01 — A. Why: B.\n\n## History\n\n<!-- guide -->\n\n${LINE}\n`,
    );
  });

  test("keeps what follows the History section", () => {
    const text = "## History\n\n- old\n\n## Notes\n\nkept\n";
    expect(freshHistory(`intro\n${text}`, LINE)).toBe(
      `intro\n## History\n\n${LINE}\n\n## Notes\n\nkept\n`,
    );
  });

  test("adds a History section when there is none", () => {
    expect(freshHistory("## Decisions\n", LINE)).toBe(`## Decisions\n\n## History\n\n${LINE}\n`);
  });
});
