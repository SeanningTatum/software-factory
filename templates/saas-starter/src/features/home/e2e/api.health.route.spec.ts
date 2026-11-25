import { expect, test } from "@playwright/test";

/**
 * The dev server can't be asked as another host (Vite refuses it), and a spec can't unset a
 * setting, so the two outcomes below depend on `.dev.vars`: with every Stripe key set the first
 * runs, without them the second does. Exactly one of them runs.
 */
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
  expect(body.database).toBe("up");
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
  expect(body.database).toBe("up");
  expect(body.missing).not.toContain("APP_URL");
  expect(body.missing).not.toContain("APP_URL (not this origin)");
});
