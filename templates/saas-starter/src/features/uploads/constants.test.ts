import { describe, expect, it } from "vitest";
import { MAX_FILES_PER_USER, PAGE_SIZE } from "./constants.ts";

describe("uploads constants", () => {
  it("keeps the count within one R2 list call (1,000 keys) and a page within the count", () => {
    expect(MAX_FILES_PER_USER).toBeLessThanOrEqual(1000);
    expect(PAGE_SIZE).toBeLessThanOrEqual(MAX_FILES_PER_USER);
  });
});
