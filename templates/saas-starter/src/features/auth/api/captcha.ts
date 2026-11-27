// software-factory-lint allow comments
import type { BetterAuthPlugin } from "better-auth";
import { captcha } from "better-auth/plugins/captcha";
import { type AppEnv, setting } from "#/app/env.ts";
import type { AuthPluginFactory } from "./auth.ts";

const GUARDED = ["/sign-up/email"];
const SIGN_IN = ["/sign-in/email"];

const isTestKey = (key: string) => /^[123]x0{20}/.test(key);

export const turnstileKeys = (env: AppEnv) => {
  const siteKey = setting(env, "TURNSTILE_SITE_KEY");
  const secretKey = setting(env, "TURNSTILE_SECRET_KEY");
  return siteKey && secretKey ? { siteKey, secretKey } : undefined;
};

/**
 * shortcut: the plugin calls Cloudflare's siteverify with its own fetch, so it has no span of its
 * own; it runs inside the `auth.handler` span. Wrap it when we need its timing alone.
 */
export const captchaPlugin: AuthPluginFactory = ({ env, onWarning }) => {
  const keys = turnstileKeys(env);
  if (!keys) return [];
  const appUrl = setting(env, "APP_URL") ?? "";
  if (isTestKey(keys.secretKey) && !/^https?:\/\/(localhost|127\.0\.0\.1)([:/]|$)/.test(appUrl))
    onWarning("Turnstile test secret in use: any token passes, so sign-up is not protected", {});
  return [turnstile(keys.secretKey, GUARDED)];
};

const turnstile = (secretKey: string, endpoints: Array<string>) =>
  captcha({ provider: "cloudflare-turnstile", secretKey, endpoints });

export const signInCaptcha = (env: AppEnv): ReadonlyArray<BetterAuthPlugin> => {
  const keys = turnstileKeys(env);
  return keys ? [turnstile(keys.secretKey, SIGN_IN)] : [];
};
