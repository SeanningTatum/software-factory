import { describe, expect, it } from "vitest";
import type { AppEnv } from "#/core/env.ts";
import { authConfig } from "./auth.ts";

const env = (vars: Record<string, string>) => vars as unknown as AppEnv;
const SECRET = "s".repeat(32);

describe("authConfig", () => {
  it("needs a long enough secret", () => {
    expect(authConfig(env({ APP_URL: "https://a.dev", BETTER_AUTH_SECRET: "short" }))).toEqual({
      missing: "BETTER_AUTH_SECRET (32+ characters)",
    });
  });

  it("needs the app's URL", () => {
    expect(authConfig(env({ BETTER_AUTH_SECRET: SECRET }))).toEqual({ missing: "APP_URL" });
  });

  it("trusts the app's origin plus listed ones, never a wildcard", () => {
    const config = authConfig(
      env({
        BETTER_AUTH_SECRET: SECRET,
        APP_URL: "https://a.dev/app",
        TRUSTED_ORIGINS: "https://b.dev, *",
      }),
    );
    expect(config).toMatchObject({
      trustedOrigins: ["https://a.dev", "https://b.dev"],
      github: undefined,
    });
  });

  it("turns GitHub on only with both keys", () => {
    const config = authConfig(
      env({
        BETTER_AUTH_SECRET: SECRET,
        APP_URL: "https://a.dev",
        GITHUB_CLIENT_ID: "id",
        GITHUB_CLIENT_SECRET: "s",
      }),
    );
    expect(config).toMatchObject({ github: { clientId: "id", clientSecret: "s" } });
  });
});
