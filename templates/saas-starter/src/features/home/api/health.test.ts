import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { type AppEnv, CloudflareEnv } from "#/app/env.ts";
import { requiredSettings } from "#/gen/env.ts";
import { readiness } from "./health.ts";

const APP = "https://app.example.com";
const complete = Object.fromEntries(requiredSettings.map((key) => [key, "set"]));
const d1 = (up: boolean) => ({
  prepare: () => ({
    first: () => (up ? Promise.resolve({ 1: 1 }) : Promise.reject(new Error("down"))),
  }),
});

const check = (env: Record<string, unknown>, url = `${APP}/api/health`) =>
  readiness(url).pipe(
    Effect.provide(CloudflareEnv.layer(env as unknown as AppEnv)),
    Effect.runPromise,
  );

describe("readiness", () => {
  it("is ready with every setting, the right origin and a working database", async () => {
    expect(await check({ ...complete, APP_URL: APP, DB: d1(true) })).toEqual({
      ok: true,
      missing: [],
      database: "up",
    });
  });

  it("is not ready while a deploy still has the local APP_URL", async () => {
    const ready = await check({ ...complete, APP_URL: "http://localhost:3000" });
    expect(ready).toMatchObject({ ok: false, missing: ["APP_URL (not this origin)"] });
  });

  it("names the required settings that are missing", async () => {
    const ready = await check({ APP_URL: APP });
    expect(ready.ok).toBe(requiredSettings.length <= 1);
    expect(ready.missing).toEqual(requiredSettings.filter((key) => key !== "APP_URL"));
  });

  it("is not ready when the database doesn't answer", async () => {
    expect(await check({ ...complete, APP_URL: APP, DB: d1(false) })).toMatchObject({
      ok: false,
      database: "down",
    });
  });

  it("says which Worker version answered", async () => {
    const CF_VERSION_METADATA = { id: "abc", tag: "v1.2.0" };
    const ready = await check({ ...complete, APP_URL: APP, CF_VERSION_METADATA });
    expect(ready.version).toEqual({ id: "abc", tag: "v1.2.0" });
  });

  it("skips the database check in a project without one", async () => {
    expect(await check({ ...complete, APP_URL: APP })).toEqual({ ok: true, missing: [] });
  });
});
