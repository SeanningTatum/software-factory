import { describe, expect, it } from "vitest";
import { commandFor, toggleBlock } from "./blocks.ts";

describe("toggleBlock", () => {
  it("picks what a block needs, all the way down", () => {
    expect(toggleBlock([], "billing")).toEqual(["db", "auth", "billing"]);
  });

  it("drops what sits on a dropped block and keeps the rest", () => {
    expect(toggleBlock(["db", "kv", "auth", "billing", "uploads"], "auth")).toEqual(["db", "kv"]);
  });

  it("leaves unrelated blocks alone", () => {
    expect(toggleBlock(["db", "auth"], "kv")).toEqual(["db", "kv", "auth"]);
    expect(toggleBlock(["db", "kv", "auth"], "kv")).toEqual(["db", "auth"]);
  });
});

describe("commandFor", () => {
  it("lists the picked blocks in the CLI's order", () => {
    expect(commandFor(["uploads", "auth", "db"])).toBe(
      "bunx @seanningtatum/create-software-factory my-app --features db,auth,uploads",
    );
  });

  it("leaves the flag out when nothing is picked", () => {
    expect(commandFor([])).toBe("bunx @seanningtatum/create-software-factory my-app");
  });
});
