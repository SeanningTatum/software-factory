import { expect, test } from "@playwright/test";
import { visitor } from "#/app/testing/e2e.ts";

test("@golden /api/browser-report takes an error report", async ({ request }) => {
  const res = await request.post("/api/browser-report", {
    data: { message: "boom", path: "/" },
    headers: visitor(),
  });
  expect(res.status()).toBe(204);
});

test("@error /api/browser-report refuses a report with no message", async ({ request }) => {
  const res = await request.post("/api/browser-report", {
    data: { path: "/" },
    headers: visitor(),
  });
  expect(res.status()).toBe(400);
});
