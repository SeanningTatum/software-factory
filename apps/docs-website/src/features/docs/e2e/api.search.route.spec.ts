import { expect, test } from "@playwright/test";

test("@golden /api/search finds a page by a word in it", async ({ request }) => {
  const res = await request.get("/api/search?query=billing");
  const hits = (await res.json()) as Array<{ url: string }>;
  expect(hits.some((hit) => hit.url.startsWith("/docs/features"))).toBe(true);
});

test("@error /api/search answers an unknown word with no hits", async ({ request }) => {
  const res = await request.get("/api/search?query=zzzqqqxxx");
  expect(await res.json()).toEqual([]);
});
