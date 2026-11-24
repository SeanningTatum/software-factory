import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import { BrowserEvent } from "../events.ts";
import { catalog } from "./catalog.ts";

const PERSONAL = /^(email|name|first_?name|last_?name|ip|ip_?address|phone|address|password)$/i;

describe("event catalog", () => {
  it("keeps personal data out of every event's properties", () => {
    for (const event of catalog) {
      const keys = Object.keys(event.fields);
      expect(keys.filter((k) => PERSONAL.test(k))).toEqual([]);
    }
  });

  it("uses snake_case event names", () => {
    for (const event of catalog) {
      const tag = (event.fields._tag.ast as unknown as { literal: unknown }).literal;
      expect(String(tag)).toMatch(/^[a-z]+(_[a-z]+)*$/);
    }
  });

  it("accepts a page view from the browser and rejects anything else", () => {
    const decode = Schema.decodeUnknownExit(BrowserEvent);
    expect(decode({ _tag: "page_viewed", path: "/" })._tag).toBe("Success");
    expect(decode({ _tag: "user_banned", path: "/" })._tag).toBe("Failure");
  });
});
