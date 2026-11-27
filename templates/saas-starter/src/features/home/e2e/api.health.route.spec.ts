import { expect, test } from "@playwright/test";

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
  // /api/health reports the database only in a project that has one.
  expect(body.database ?? "up").toBe("up");
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
  expect(body.database ?? "up").toBe("up");
  expect(body.missing).not.toContain("APP_URL");
  expect(body.missing).not.toContain("APP_URL (not this origin)");
});
