import { describe, expect, it } from "vitest";
import { type AppEnv, setting } from "./env.ts";

const env = { APP_URL: " https://x.dev ", BLANK: "  ", NUMBER: 3 } as unknown as AppEnv;

describe("setting", () => {
  it("trims a set value", () => expect(setting(env, "APP_URL")).toBe("https://x.dev"));
  it("treats blank and missing as unset", () => {
    expect(setting(env, "BLANK")).toBeUndefined();
    expect(setting(env, "NOPE")).toBeUndefined();
  });
  it("ignores bindings that are not strings", () => expect(setting(env, "NUMBER")).toBeUndefined());
});
