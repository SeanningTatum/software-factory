import { expect, test } from "vitest";
import { source } from "./source.ts";

test("content/docs/index.mdx is served at /docs", () => {
  expect(source.getPage([])?.url).toBe("/docs");
});

test("slugs with no file have no page", () => {
  expect(source.getPage(["no-such-page"])).toBeUndefined();
});
