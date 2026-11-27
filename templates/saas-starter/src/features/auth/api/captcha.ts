import { captcha } from "better-auth/plugins/captcha";
import { type AppEnv, setting } from "#/app/env.ts";
import type { AuthPluginFactory } from "./auth.ts";

/** The one path a bot farm has to hit to make accounts. */
const GUARDED = ["/sign-up/email"];

/** Cloudflare's published test keys all start `1x`, `2x` or `3x` and a long run of zeros. */
const isTestKey = (key: string) => /^[123]x0{20}/.test(key);

export const turnstileKeys = (env: AppEnv) => {
  const siteKey = setting(env, "TURNSTILE_SITE_KEY");
  const secretKey = setting(env, "TURNSTILE_SECRET_KEY");
  return siteKey && secretKey ? { siteKey, secretKey } : undefined;
};

/**
 * Sign-up needs a Turnstile token in the `x-captcha-response` header (400 when it is missing, 403
 * when Cloudflare rejects it). Sign-in is left open: the rate limit covers guessing, and a bot
 * gains nothing by signing in. Off until both keys are set.
 *
 * shortcut: the plugin calls Cloudflare's siteverify with its own fetch, so there is no span of its
 * own; it runs inside the `auth.handler` span. Wrap it when we need its timing alone.
 */
export const captchaPlugin: AuthPluginFactory = ({ env, onWarning }) => {
  const keys = turnstileKeys(env);
  if (!keys) return [];
  const appUrl = setting(env, "APP_URL") ?? "";
  if (isTestKey(keys.secretKey) && !/^https?:\/\/(localhost|127\.0\.0\.1)([:/]|$)/.test(appUrl))
    onWarning("Turnstile test secret in use: any token passes, so sign-up is not protected", {});
  return [
    captcha({
      provider: "cloudflare-turnstile",
      secretKey: keys.secretKey,
      endpoints: GUARDED,
    }),
  ];
};
