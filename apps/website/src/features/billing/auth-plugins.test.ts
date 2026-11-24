import { describe, expect, it } from "vitest";
import type { AppEnv } from "#/app/env.ts";
import { authPlugins } from "./auth-plugins.ts";

const deps = (env: Record<string, string>) => ({
  env: env as unknown as AppEnv,
  onEvent: () => undefined,
  onWarning: () => undefined,
});

describe("billing auth plugins", () => {
  it("stay off without Stripe keys", () => {
    expect(authPlugins(deps({}))).toEqual([]);
  });
  it("add the Stripe plugin once keys are set", () => {
    const plugins = authPlugins(
      deps({ STRIPE_SECRET_KEY: "sk_test_x", STRIPE_WEBHOOK_SECRET: "whsec_x" }),
    );
    expect(plugins.map((p) => p.id)).toEqual(["stripe"]);
  });
});
