import { describe, expect, it } from "vitest";
import { Database } from "./api/database.ts";
import { layer } from "./layer.ts";

describe("d1 layer", () => {
  it("is the Database layer", () => {
    expect(layer).toBe(Database.layer);
  });
});
