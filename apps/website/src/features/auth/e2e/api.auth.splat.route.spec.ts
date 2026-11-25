import { expect, test } from "@playwright/test";
import { visitor } from "#/app/testing/e2e.ts";

test("@golden /api/auth answers a session check", async ({ request }) => {
  const res = await request.get("/api/auth/get-session", { headers: visitor() });
  expect(res.status()).toBe(200);
});

test("@error /api/auth refuses a sign-in with an unknown account", async ({ baseURL, request }) => {
  const res = await request.post("/api/auth/sign-in/email", {
    data: { email: "nobody@example.com", password: "not the password" },
    headers: { ...visitor(), origin: String(baseURL) },
  });
  expect(res.status()).toBe(401);
});
