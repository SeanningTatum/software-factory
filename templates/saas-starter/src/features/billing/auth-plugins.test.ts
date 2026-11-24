import type { AuthContext } from "better-auth";
import { describe, expect, it } from "vitest";
import type { AppEnv } from "#/app/env.ts";
import { authPlugins, webhookRetry } from "./auth-plugins.ts";

const deps = (env: Record<string, string>) => ({
  env: env as unknown as AppEnv,
  onEvent: () => undefined,
  onWarning: () => undefined,
  loggedErrors: () => 0,
});

describe("billing auth plugins", () => {
  it("stay off without Stripe keys", () => {
    expect(authPlugins(deps({}))).toEqual([]);
  });
  it("add the Stripe plugin and its webhook retry once keys are set", () => {
    const plugins = authPlugins(
      deps({ STRIPE_SECRET_KEY: "sk_test_x", STRIPE_WEBHOOK_SECRET: "whsec_x" }),
    );
    expect(plugins.map((p) => p.id)).toEqual(["stripe", "stripe-webhook-retry"]);
  });
});

describe("webhookRetry", () => {
  const ctx = {} as AuthContext;
  const answer = async (path: string, errors: number, status = 200) => {
    const plugin = webhookRetry(() => errors);
    await plugin.onRequest?.(new Request(`https://x.dev/api/auth${path}`, { method: "POST" }), ctx);
    const replaced = await plugin.onResponse?.(new Response("{}", { status }), ctx);
    return replaced ? replaced.response.status : status;
  };

  it("turns a webhook the plugin swallowed into a 500, so Stripe retries", async () =>
    expect(await answer("/stripe/webhook", 1)).toBe(500));
  it("leaves a clean webhook alone", async () =>
    expect(await answer("/stripe/webhook", 0)).toBe(200));
  it("leaves other auth routes alone even when something was logged", async () =>
    expect(await answer("/sign-up/email", 1)).toBe(200));
});
