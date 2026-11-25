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

// Assumes the Turnstile test keys from .dev.vars.example, as every browser spec does.
test("@error /api/auth refuses a sign-up with no Turnstile token", async ({ baseURL, request }) => {
  const res = await request.post("/api/auth/sign-up/email", {
    data: { email: "bot@example.com", password: "correct horse battery", name: "Bot" },
    headers: { ...visitor(), origin: String(baseURL) },
  });
  expect(res.status()).toBe(400);
  expect(await res.json()).toMatchObject({ code: "MISSING_RESPONSE" });
});
