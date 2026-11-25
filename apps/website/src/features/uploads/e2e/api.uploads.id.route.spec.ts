import { expect, test } from "@playwright/test";
import { signUp } from "#/app/testing/e2e.ts";

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);

test("@golden /api/uploads/:id downloads then deletes a file", async ({ page }) => {
  await signUp(page, "E2E Api File");
  const made = await page.request.post("/api/uploads", {
    multipart: { file: { name: "cat.png", mimeType: "image/png", buffer: PNG } },
  });
  const { id } = (await made.json()) as { id: string };
  const got = await page.request.get(`/api/uploads/${id}`);
  expect(got.status()).toBe(200);
  expect(await got.body()).toEqual(PNG);
  expect((await page.request.delete(`/api/uploads/${id}`)).status()).toBe(204);
  expect((await page.request.get(`/api/uploads/${id}`)).status()).toBe(404);
});

test("@error /api/uploads/:id answers 404 for a file that is not there", async ({ page }) => {
  await signUp(page, "E2E Api Missing");
  expect((await page.request.get("/api/uploads/no-such-file")).status()).toBe(404);
});

test("@error /api/uploads/:id answers 401 to a signed-out visitor", async ({ request }) => {
  expect((await request.get("/api/uploads/anything")).status()).toBe(401);
});
