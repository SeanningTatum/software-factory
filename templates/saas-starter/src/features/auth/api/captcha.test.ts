import { describe, expect, it } from "vitest";
import type { AppEnv } from "#/app/env.ts";
import { captchaPlugin, turnstileKeys } from "./captcha.ts";

const TEST_SECRET = "1x0000000000000000000000000000000AA";
const envWith = (vars: Record<string, string>) => vars as unknown as AppEnv;
const deps = (env: AppEnv, warnings: Array<string> = []) => ({
  env,
  onEvent: () => {},
  onWarning: (message: string) => void warnings.push(message),
  loggedErrors: () => 0,
});

describe("turnstileKeys", () => {
  it("needs both keys", () => {
    expect(turnstileKeys(envWith({}))).toBeUndefined();
    expect(turnstileKeys(envWith({ TURNSTILE_SITE_KEY: "s" }))).toBeUndefined();
    expect(turnstileKeys(envWith({ TURNSTILE_SECRET_KEY: "k" }))).toBeUndefined();
    expect(turnstileKeys(envWith({ TURNSTILE_SITE_KEY: "s", TURNSTILE_SECRET_KEY: "k" }))).toEqual({
      siteKey: "s",
      secretKey: "k",
    });
  });
});

describe("captchaPlugin", () => {
  it("adds nothing without keys", () => {
    expect(captchaPlugin(deps(envWith({ APP_URL: "http://localhost:3000" })))).toEqual([]);
  });

  it("adds the captcha plugin with both keys", () => {
    const plugins = captchaPlugin(
      deps(envWith({ TURNSTILE_SITE_KEY: "s", TURNSTILE_SECRET_KEY: "k" })),
    );
    expect(plugins.map((plugin) => plugin.id)).toEqual(["captcha"]);
  });

  it("warns about the test secret anywhere but localhost", () => {
    const keys = { TURNSTILE_SITE_KEY: "s", TURNSTILE_SECRET_KEY: TEST_SECRET };
    const local: Array<string> = [];
    captchaPlugin(deps(envWith({ ...keys, APP_URL: "http://localhost:3000" }), local));
    expect(local).toEqual([]);
    const live: Array<string> = [];
    captchaPlugin(deps(envWith({ ...keys, APP_URL: "https://app.example.com" }), live));
    expect(live).toHaveLength(1);
  });
});
