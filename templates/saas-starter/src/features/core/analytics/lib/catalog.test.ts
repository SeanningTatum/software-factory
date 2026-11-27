import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import { BrowserEvent } from "../events.ts";
import { catalog } from "./catalog.ts";

interface Metric {
  readonly name: string;
  readonly events: ReadonlyArray<string>;
}
const eventFiles = import.meta.glob<{ metric?: Metric }>(
  ["/src/features/*/events.ts", "/src/features/core/*/events.ts"],
  { eager: true },
);
const tagOf = (event: (typeof catalog)[number]) =>
  String((event.fields._tag.ast as unknown as { literal: unknown }).literal);

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
      expect(tagOf(event)).toMatch(/^[a-z]+(_[a-z]+)*$/);
    }
  });

  it.each(Object.entries(eventFiles))("%s names a metric measured by catalog events", (_, file) => {
    const tags = new Set(catalog.map(tagOf));
    expect(file.metric?.name).toBeTruthy();
    expect(file.metric?.events.length).toBeGreaterThan(0);
    expect(file.metric?.events.filter((e) => !tags.has(e))).toEqual([]);
  });

  it("accepts a page view from the browser and rejects anything else", () => {
    const decode = Schema.decodeUnknownExit(BrowserEvent);
    expect(decode({ _tag: "page_viewed", path: "/" })._tag).toBe("Success");
    expect(decode({ _tag: "user_banned", path: "/" })._tag).toBe("Failure");
  });
});
