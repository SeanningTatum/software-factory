import { expect, test } from "@playwright/test";
import { visitor } from "#/app/testing/e2e.ts";

test("@golden /api/events takes a batch of browser events", async ({ request }) => {
  const res = await request.post("/api/events", {
    data: { events: [{ _tag: "page_viewed", path: "/" }] },
    headers: visitor(),
  });
  expect(res.status()).toBe(204);
});

test("@error /api/events refuses an event it does not know", async ({ request }) => {
  const res = await request.post("/api/events", {
    data: { events: [{ _tag: "nope" }] },
    headers: visitor(),
  });
  expect(res.status()).toBe(400);
});
