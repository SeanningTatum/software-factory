import { type BetterAuthPlugin, betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { type AppEnv, setting } from "#/app/env.ts";
import type { AnalyticsEvent } from "#/features/core/analytics/lib/catalog.ts";
import type { Db } from "#/features/core/db/api/database.ts";
import { authSchema } from "../schema.ts";

const MIN_SECRET_LENGTH = 32;
const SESSION_DAYS = 30;
const DAY_SECONDS = 60 * 60 * 24;

/** What a feature that extends auth (billing, for one) gets to build its Better Auth plugins. */
interface AuthPluginDeps {
  readonly env: AppEnv;
  /** Queues an analytics event; it is sent with the request's batch. */
  readonly onEvent: (event: AnalyticsEvent) => void;
  /** Queues a warning for the request's log, with the request id on it. */
  readonly onWarning: (message: string, details: Record<string, unknown>) => void;
  /** How many errors Better Auth has logged while serving this request. */
  readonly loggedErrors: () => number;
}

/** Where Better Auth's own log lines go: the request's log and, for errors, the error reporter. */
export type AuthLog = (level: "debug" | "info" | "warn" | "error", message: string) => void;
export type AuthPluginFactory = (deps: AuthPluginDeps) => ReadonlyArray<BetterAuthPlugin>;

export interface AuthConfig {
  readonly secret: string;
  readonly baseURL: string;
  readonly trustedOrigins: ReadonlyArray<string>;
}

/** Checks the settings auth needs. Returns the name of the first bad one, or the config. */
export const authConfig = (env: AppEnv): AuthConfig | { readonly missing: string } => {
  const secret = setting(env, "BETTER_AUTH_SECRET");
  if (!secret || secret.length < MIN_SECRET_LENGTH)
    return { missing: "BETTER_AUTH_SECRET (32+ characters)" };
  const baseURL = setting(env, "APP_URL");
  if (!baseURL) return { missing: "APP_URL" };
  // `new URL` throws on a bare host, and this runs while the layer is built: every route would 500.
  if (!/^https?:\/\//.test(baseURL) || !URL.canParse(baseURL))
    return { missing: "APP_URL (a full https:// URL)" };
  const extra = (setting(env, "TRUSTED_ORIGINS") ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin && origin !== "*");
  return {
    secret,
    baseURL,
    trustedOrigins: [new URL(baseURL).origin, ...extra],
  };
};

export const makeAuth = (
  config: AuthConfig,
  db: Db,
  plugins: ReadonlyArray<BetterAuthPlugin>,
  log: AuthLog,
) =>
  betterAuth({
    secret: config.secret,
    baseURL: config.baseURL,
    basePath: "/api/auth",
    trustedOrigins: [...config.trustedOrigins],
    database: drizzleAdapter(db, { provider: "sqlite", schema: authSchema }),
    emailAndPassword: { enabled: true, minPasswordLength: 10 },
    session: {
      expiresIn: SESSION_DAYS * DAY_SECONDS,
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
    // Workers rate-limit bindings guard sign-in and sign-up instead; see rate-limit.ts.
    rateLimit: { enabled: false },
    advanced: { useSecureCookies: config.baseURL.startsWith("https://") },
    // Plugins (Stripe's webhook, for one) catch their own failures and only log them; route those
    // lines to our logger and error reporter instead of the console.
    logger: { level: "warn", log: (level, message) => log(level, message) },
    plugins: [...plugins, tanstackStartCookies()],
  });
