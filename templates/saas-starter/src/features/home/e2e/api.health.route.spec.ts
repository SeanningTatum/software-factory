// software-factory-lint allow comments
import { existsSync } from "node:fs";
import { expect, test } from "@playwright/test";

// Only the `db` feature owns drizzle.config.ts, and /api/health reports the database only then.
const hasDb = existsSync("drizzle.config.ts");

const health = async (request: import("@playwright/test").APIRequestContext) => {
  const res = await request.get("/api/health");
  return {
    res,
    body: (await res.json()) as { ok: boolean; missing: Array<string>; database?: string },
  };
};

test("@golden /api/health answers 200 with good settings", async ({ request }) => {
  const { res, body } = await health(request);
  test.skip(!body.ok, `Settings missing: ${body.missing.join(", ")}`);
  expect(res.status()).toBe(200);
  expect(body.database).toBe(hasDb ? "up" : undefined);
});

test("@error /api/health answers 503 and names what is missing", async ({ request }) => {
  const { res, body } = await health(request);
  test.skip(body.ok, "Every setting is set.");
  expect(res.status()).toBe(503);
  expect(body.missing.length).toBeGreaterThan(0);
  expect(body.missing.every((name) => /^[A-Z_]+/.test(name))).toBe(true);
});

test("@golden /api/health finds the database and APP_URL", async ({ request }) => {
  const { body } = await health(request);
  expect(body.database).toBe(hasDb ? "up" : undefined);
  expect(body.missing).not.toContain("APP_URL");
  expect(body.missing).not.toContain("APP_URL (not this origin)");
});
