import { Context, Layer } from "effect";
import type { BlockSecrets } from "#/gen/env.ts";

/** Bindings and vars from wrangler (see worker-configuration.d.ts) plus the secrets blocks declare. */
export type AppEnv = Env & BlockSecrets;

export class CloudflareEnv extends Context.Service<CloudflareEnv, AppEnv>()(
  "app/core/CloudflareEnv",
) {
  static readonly layer = (env: AppEnv) => Layer.succeed(CloudflareEnv)(env);
}

/** Keeps the Worker alive for work that finishes after the response, such as flushing analytics. */
export class WaitUntil extends Context.Service<WaitUntil, (promise: Promise<unknown>) => void>()(
  "app/core/WaitUntil",
) {
  static readonly layer = (waitUntil: (promise: Promise<unknown>) => void) =>
    Layer.succeed(WaitUntil)(waitUntil);
}

/** A var or secret as a trimmed string, or undefined when it is missing or blank. */
export const setting = (env: AppEnv, key: string): string | undefined => {
  const value = (env as unknown as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
};
