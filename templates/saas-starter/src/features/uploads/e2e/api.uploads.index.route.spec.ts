import { expect, test } from "@playwright/test";
import { signUp } from "#/app/testing/e2e.ts";

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);

test("@golden /api/uploads stores a file and lists it", async ({ page }) => {
  await signUp(page, "E2E Api Files");
  const made = await page.request.post("/api/uploads", {
    multipart: { file: { name: "cat.png", mimeType: "image/png", buffer: PNG } },
  });
  expect(made.status()).toBe(201);
  const list = await page.request.get("/api/uploads");
  expect(list.status()).toBe(200);
  expect(await list.json()).toMatchObject({ files: [{ name: "cat.png" }] });
});

test("@error /api/uploads answers 401 to a signed-out visitor", async ({ request }) => {
  expect((await request.get("/api/uploads")).status()).toBe(401);
});

test("@error /api/uploads answers 400 when the form has no file", async ({ page }) => {
  await signUp(page, "E2E Api Empty");
  const res = await page.request.post("/api/uploads", { multipart: { note: "no file here" } });
  expect(res.status()).toBe(400);
});
